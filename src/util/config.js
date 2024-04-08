/**
 * ilgilog
 */

"use strict";

const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const config = {
    log: {
        dir: process.env.LOG_DIR,
    },

    webServer: {
        host: process.env.WS_HOST,
        port: process.env.WS_PORT,
    },

    database: {
        connection: {
            config: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                connectionLimit: process.env.DB_CONNECTION_LIMIT,
            },
        },

        schema: {
            COMMON: process.env.DB_NAME,
        },
    },

    jwt: {
        accessExp: process.env.ACCESS,
        refreshExp: process.env.REFRESH,
        secret: process.env.SECRET,
    },

    kakao: {
        client_id: process.env.KAKAO_REST_API,
        redirect_url: process.env.KAKAO_REDIRECT_URL,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
    },
};

module.exports = config;
