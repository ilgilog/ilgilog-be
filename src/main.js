/*
 *  ilgilog
 */

"use strict";

// 필수 라이브러리 로드
const moment = require("moment-timezone");
const SERVICE_INIT_WAIT = 30;


// ? process.send 함수가 없을 경우 고려 (https://stackoverflow.com/questions/30585540/process-send-is-conditionally-defined-in-node-js)
process.send = process.send || function () {};

/**
 * 서비스 초기화
 * @returns
 */
async function init() {
    let log;
    let init = false;

    try {
        // 서비스 초기화 중 blocking이 발생했을 경우 알릴 수 있는 로직
        setTimeout(() => {
            if (init) return;

            if (log) {
                log.error("Service initialize is incomplete!");
            } else {
                console.error("Service initialize is incomplete!");
            }

            process.exit(1);
        }, 1000 * SERVICE_INIT_WAIT);

        // moment 로캘 설정
        moment.locale("ko");

        // 전역 변수 세팅
        global.GV = {
            rootLocation: require("path").join(__dirname, "../"), // 프로젝트 루트 경로
            isFirstInstance: (process.env.NODE_APP_INSTANCE ?? "0") === "0",
        };

        // util 로드
        let util = require("./util");
        log = util.log;

        // 현재 NODE_ENV 출력
        log.info(`NODE_ENV: ${process.env.NODE_ENV ?? "unknown"}`);

        // Mysql ---
        let mysql = require("./mysql/main");
        await mysql.init();

        // Express ---
        let express = require("./express/main");
        await express.init();

        log.info("System ready");
        init = true;

        process.send("ready");
    } catch (exception) {
        // log 객체가 이미 로드 되었을 경우 Log로 출력
        if (log) {
            log.error(`${exception.stack ?? exception}`);
            log.error("Service intialize stopped.");
        } else {
            console.error(exception.stack ?? exception);
            console.error("Service initialize stoppped");
        }
    }
}

init();
