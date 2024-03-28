/*
 *  ilgilog
 */

"use strict";

const path = require("path");
const util = require("node:util");
const moment = require("moment-timezone");
const winston = require("winston");
const winstonDaily = require("winston-daily-rotate-file");
const config = require("./config");

const { combine, timestamp, label, printf, prettyPrint } = winston.format;

const logDir = path.join(process.cwd(), config.log.dir);

const logFormat = printf(({ level, message, timestamp }) => {
    if (typeof message === "object") {
        message = util.inspect(message, { depth: null });
    }

    return `${timestamp} ${level}: ${message}`; // 날짜 로그레벨 메세지
});

const timezoneStamp = () => {
    return "[" + moment.tz("Asia/Seoul").format("HH:mm:ss.SSS") + "]";
};

const winstonConfig = {
    levels: {
        // 숫자가 낮을 수록 우선순위가 높습니다.
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        silly: 6,
        yell: 7,
    },
    colors: {
        // 각각의 레벨에 대한 색상을 지정해줍니다.
        error: "red",
        warn: "yellow",
        info: "green",
        data: "magenta",
        verbose: "cyan",
        debug: "blue",
        silly: "grey",
    },
};

winston.addColors(winstonConfig.colors); // 컬러를 적용하는 부분인 듯합니다.

const log = winston.createLogger({
    levels: winstonConfig.levels,
    format: combine(timestamp({ format: timezoneStamp }), logFormat),

    transports: [
        new winstonDaily({
            level: "yell",
            datePattern: "YYYY-MM-DD",
            dirname: logDir,
            filename: `%DATE%.log`,
            maxSize: "10m",
            utc: true,
            zippedArchive: false,
        }),

        new winstonDaily({
            level: "error",
            datePattern: "YYYY-MM-DD",
            dirname: logDir,
            filename: `%DATE%.error.log`,
            maxSize: "10m",
            utc: true,
            zippedArchive: false,
        }),
    ],

    exceptionHandlers: [
        new winstonDaily({
            level: "error",
            datePattern: "YYYY-MM-DD",
            dirname: logDir,
            filename: `%DATE%.unhandled-exception.log`,
            maxSize: "10m",
            utc: true,
            zippedArchive: false,
        }),
    ],

    exitOnError: false,
});

log.add(
    new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
        level: "yell",
        format: winston.format.combine(
            winston.format.colorize(), // 색깔 넣어서 출력
            logFormat,
        ),
    }),
);

module.exports = log;
