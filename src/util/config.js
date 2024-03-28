/*
 *  ilgilog
 */

"use strict";

const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const config = {
    log: {
        dir: process.env.LOG_DIR, // "../../maintenance/serverlog"
    },

    serviceSignature: process.env.SERVICE_SIGNATURE || "unknown",
    keySalt: process.env.KEY_SALT,
    defaultLanguage: process.env.DEFAULT_LANGUAGE || "en",

    webServer: {
        host: process.env.WS_HOST, // server ip
        port: process.env.WS_PORT, // port number

        rateLimit: {
            windowsMS: process.env.WS_RATE_LIMIT_WINDOWS_MS || 1 * 60 * 1000,
            max: process.env.WS_RATE_LIMIT_MAX || 100,
        },

        cors: {
            // allowOrigin: process.env.WS_CORS_ALLOW_ORIGIN.split(",").map((v) => v.trim()),
            allowOrigin: process.env.WS_CORS_ALLOW_ORIGIN,
        },
    },

    database: {
        connection: {
            writer: [],

            reader: [],

            config: {
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                connectionLimit: process.env.DB_CONNECTION_LIMIT ?? 10,
            },
        },

        schema: {
            COMMON: process.env.DB_SCHEMA,
        },
    },
};

for (let v of process.env.DB_HOST_WRITER.split(",")) {
    v = v.trim();

    let hostSplit = v
        .trim()
        .split(":")
        .map((v2) => v2.trim());

    config.database.connection.writer.push({
        host: hostSplit[0],
        port: hostSplit[1],
    });
}

for (let v of process.env.DB_HOST_READER.split(",")) {
    v = v.trim();

    let hostSplit = v
        .trim()
        .split(":")
        .map((v2) => v2.trim());

    config.database.connection.reader.push({
        host: hostSplit[0],
        port: hostSplit[1],
    });
}

module.exports = config;
