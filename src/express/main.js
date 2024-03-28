/**
 *  ilgilog
 */

"use strict";

const express = { _server: null, _init: false };

const engine = require("express");
const path = require("path");
const rateLimiter = require("express-rate-limit");
const cors = require("cors");

const mysql = require("../mysql/main");
const moment = require("moment-timezone");
const expressValidator = require("express-validator");
const validationHandler = require("./validationHandler");
const errorCode = require("./errorCode");
const { util, log, config } = require("../util");

/**
 * express 엔진 초기화
 * @returns
 */
express.init = function () {
    return new Promise(async (resolve, reject) => {
        try {
            if (this._init) return;

            // 웹 서버 초기화 시작 ->
            let webServer = engine();

            // 프록시 신뢰 설정 (https://expressjs.com/ko/guide/behind-proxies.html)
            webServer.set("trust proxy", 1);

            // 보안 미들웨어 등록
            webServer.use(require("helmet")());

            // gzip 압축 활성화
            webServer.use(require("compression")());

            webServer.use(
                cors({
                    origin: config.webServer.cors.allowOrigin,
                    credentials: true,
                }),
            );

            // 운영 환경일 시 Rate limit 등록
            if (process.env.NODE_ENV === "production") {
                webServer.use(
                    rateLimiter({
                        windowMs: config.webServer.rateLimit.windowMs,
                        max: config.webServer.rateLimit.max,
                        standardHeaders: true,
                        legacyHeaders: false,
                        message: async (req, res) => {
                            return {
                                result: "N",
                                code: 1101,
                                message: "Too many request",
                            };
                        },
                    }),
                );
            }

            // 클라이언트 ipAddress 반환하는 미들웨어 등록
            webServer.use(require("request-ip").mw({ attributeName: "ipAddress" }));

            // application/json, x-www-form-urlencoded 파싱을 위해 미들웨어 등록
            webServer.use(engine.json({ strict: false }));
            webServer.use(engine.urlencoded({ extended: true }));

            webServer.use((req, res, next) => {
                //성공 함수
                res.successResponse = (data, statusCode) => {
                    let dataTable = {
                        result: "Y",
                        code: 0,
                        message: "Success",
                    };

                    if (data) {
                        dataTable.data = data;
                    }

                    res.status(statusCode ?? 200).json(dataTable);

                    this._printSuccessLog(req, res, dataTable);
                };

                res.failResponse = (code, data, statusCode) => {
                    let dataTable = {
                        result: "N",
                        code: 2000,
                        message: "Unknown error",
                        ...errorCode.get(code),
                    };

                    if (data) {
                        dataTable = { ...dataTable, ...data };
                    }

                    res.status(statusCode ?? 200).json(dataTable);

                    this._printSuccessLog(req, res, dataTable);
                };

                // 다음 미들웨어 실행
                next();
            });

            // 라우터 파일 전체 로드를 위해 폴더 스캔
            let routerFiles = await util.getFilesInDirectoryDeep(process.env.ROUTER_PATH);
            // let routerFiles = await util.getFilesInDirectoryDeep(path.join(GV.rootLocation, "src", "express", "router", "**/*.js"));

            let routers = engine.Router();
            // root
            routers.get("/", (req, res) => {
                res.send("");
            });

            // favicon에 대한 204 반환
            routers.get("/favicon.ico", (req, res) => {
                res.status(204).end();
            });

            if (routerFiles) {
                // async 함수의 경우 express 자체 오류 처리기에서 처리가 불가능하기에 처리 가능하도록 재정의 (https://programmingsummaries.tistory.com/399)
                let asyncFunctionSignature = (async () => {}).constructor;
                let errorProcessableHandler = (handler) => {
                    for (let k in handler) {
                        if (handler[k] instanceof asyncFunctionSignature) {
                            // 기존 handler 백업 후..
                            let v = handler[k];

                            // handler promise catch 문 추가 후 재정의
                            handler[k] = async (req, res, next) => {
                                await v(req, res, next).catch(next);
                            };
                        }
                    }

                    return handler;
                };

                const anonymousPath = ["/api/user/login"];

                // 라우터 파일에 넘겨줄 커스텀 함수 데이터 지정
                // this.PREFIX의 경우 router 파일 안에 있는 this.PREFIX 변수와 연동됨
                let routerFunction = {
                    GET: function (location, ...handler) {
                        // 실수로 첫 문자를 /로 입력하여 지정할 경우 보정
                        if (location[0] === "/") location = location.substring(1);

                        let list = [express.validateTimestamp];

                        if (anonymousPath.includes(`${this.PREFIX}/${location}`)) {
                            list.push(errorProcessableHandler(handler));
                        }

                        routers.get(`/${this.PREFIX}/${location}`, list);
                    },

                    POST: function (location, ...handler) {
                        // 실수로 첫 문자를 /로 입력하여 지정할 경우 보정
                        if (location[0] === "/") location = location.substring(1);

                        let list = [express.validateTimestamp];

                        if (anonymousPath.includes(`${this.PREFIX}/${location}`)) {
                            list.push(errorProcessableHandler(handler));
                        }

                        routers.post(`/${this.PREFIX}/${location}`, list);
                    },
                };

                const routerIncludes = [mysql, util, moment, { ...expressValidator, validationHandler }, config.database.schema];

                // 루프를 통해 router 폴더 내의 모든 라우터 파일 로드
                for (let v of routerFiles) {
                    try {
                        //라우터 로드
                        let routerModule = require(path.join(v));

                        if (!routerModule.router) {
                            log.error(`Express - Load rejected [${v}] (error: Unknown router format)`);
                            continue;
                        }

                        routerModule.router.apply(routerFunction, routerIncludes);
                    } catch (exception) {
                        log.error(`Express = Router group [/${routerFunction.PREFIX}] failed to load (exception: ${exception.stack ?? exception})`);
                    }
                }
                log.info(`Express - Router loaded (${routerFiles.length} files)`);

                webServer.use("/", routers);
            } else {
                log.error(`Express - Load error (error: Failed to load scan router files)`);
            }

            // Not found 처리
            webServer.use((req, res, next) => {
                if (!res.headersSent) {
                    res.failResponse("Not Found");
                }
            });

            webServer.use((err, req, res, next) => {
                log.error(`Express - Server error (exception: ${err.stack ?? err})`);

                if (!res.headersSent) {
                    res.failResponse("Server Error");
                }
            });

            // Helper 함수 적용시 사용
            // await express.bootstrapHelpers();

            // 해당 포트로 웹서버 리스닝
            webServer.listen(config.webServer.port, config.webServer.host, () => {
                log.info(`Express - Listening (${config.webServer.host}:${config.webServer.port})`);

                resolve();
            });

            // 웹서버 초기화 끝 ->

            this._server = webServer;
            this._init = true;
        } catch (exception) {
            reject(exception);
        }
    });
};

/**
 * 성공 응답 시 로그 출력
 * @param {Express.request} req Express request
 * @param {Express.response} res Express response
 * @param {object} dataTable Error code dataTable
 */
express._printSuccessLog = function (req, res, dataTable) {
    log.info(`Express - ${req.ipAddress} -> ${req.protocol.toUpperCase() ?? "unknown"}/${req.httpVersion} ${req.method.toUpperCase()} ${req.originalUrl} > ${res.statusCode} Success`);
};

/**
 * 실패 응답 시 로그 출력
 * @param {Express.request} req Express request
 * @param {Express.response} res Express response
 * @param {object} dataTable Error code dataTable
 */
express._printFailLog = function (req, res, dataTable) {
    log.warn(`Express - ${req.ipAddress} -> ${req.protocol.toUpperCase() ?? "unknown"}/${req.httpVersion} ${req.method.toUpperCase()} ${req.originalUrl} > ${res.statusCode} Fail (code: ${dataTable.code}, message: ${dataTable.message})`);
};

// production 모드일 경우에만 timestamp 체크
if (process.env.NODE_ENV === "production") {
    /**
     * timestamp 파라메터 검사 미들웨어
     * @param {Express.request} req Express request
     * @param {Express.response} res Express response
     * @param {Express.next} next Express next
     */
    express.validateTimestamp = function (req, res, next) {
        let timestamp = Number(req.method === "GET" ? req.query.timestamp : req.body.timestamp);

        if (!timestamp || !Number.isInteger(timestamp)) {
            res.failResponse("Parameter Invalid");
            return;
        }

        if (Math.abs(timestamp - util.getCurrentTimestamp()) > 10) {
            res.failResponse("Timestamp Invalid");
            return;
        }

        // 다음 미들웨어 실행
        next();
    };
} else {
    /**
     * timestamp 파라메터 검사 미들웨어
     * @param {Express.request} req Express request
     * @param {Express.response} res Express response
     * @param {Express.next} next Express next
     */
    express.validateTimestamp = function (req, res, next) {
        // 다음 미들웨어 실행
        next();
    };
}

module.exports = express;
