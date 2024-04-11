/**
 * ilgilog
 */

"use strict";

const express = { _server: null, _init: false };

const engine = require("express");
const { util, log, config } = require("../util");
const errorCode = require("./errorCode");

const userRouter = require("./router/user");
const testRouter = require("./router/test");
const mainRouter = require("./router/main");
const homepyRouter = require("./router/homepy");

express.init = function () {
    return new Promise(async (resolve, reject) => {
        try {
            if (this._init) return;

            let webServer = engine();

            webServer.set("trust proxy", 1);
            webServer.use(require("helmet")());
            webServer.use(require("compression")());

            webServer.use(engine.json({ strict: false }));
            webServer.use(engine.urlencoded({ extended: true }));

            webServer.use((req, res, next) => {
                // 성공 함수
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

                    if (statusCode !== 200) {
                        res.status(statusCode ?? 200).json(dataTable);
                        this._printFailLog(req, res, dataTable);
                    }
                };

                // 다음 미들웨어 실행
                next();
            });

            webServer.use(express.validateTimestamp);
            webServer.use(require("request-ip").mw({ attributeName: "ipAddress" }));

            webServer.use("/api/user", userRouter);
            webServer.use("/api/test", testRouter);
            webServer.use("/api/main", mainRouter);
            webServer.use("/api/homepy", homepyRouter);

            let routers = engine.Router();

            routers.get("/", (req, res) => {
                res.send("hello world");
            });

            routers.get("/favicon.ico", (req, res) => {
                res.status(204).end();
            });

            webServer.use((req, res, next) => {
                if (!res.headersSent) {
                    res.status(404).send("Not Found");
                }
            });

            webServer.use((err, req, res, next) => {
                log.error(`Express - Server Error (exception: ${err.stack ?? err})`);
                if (!res.headersSent) {
                    res.status(500).send("Server Error");
                }
            });

            webServer.listen(config.webServer.port, config.webServer.host, () => {
                log.info(`Express - Listening (${config.webServer.host}:${config.webServer.port})`);

                resolve();
            });

            this._server = webServer;
            this._init = true;
        } catch (exception) {
            log.error(exception);
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

express.validateTimestamp = function (req, res, next) {
    let timestamp = Number(req.method === "GET" ? req.query.timestamp : req.body.timestamp);

    if (!timestamp || !Number.isInteger(timestamp)) {
        res.failResponse("ParameterInvalid");
        return;
    }

    if (Math.abs(timestamp - util.getCurrentTimestamp()) > 10) {
        res.failResponse("TimestampInvalid");
        return;
    }

    next();
};
module.exports = express;
