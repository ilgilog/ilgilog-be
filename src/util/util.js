/**
 *  ilgilog
 */

"use strict";

let util = {};

const moment = require("moment-timezone");
const nodeUtil = require("util");
const config = require("./config");
const jwt = require("jsonwebtoken");

util.sleep = (ms) => new Promise((resolve) => setTimeout(resolvem, ms));

/**
 * 안전하게 json 문자열을 파싱
 * @param {string} jsonText 변환할 json 문자열
 * @param {any} defaultValue 변환에 실패했을 경우 반환할 값
 * @returns {any} 객체
 */
util.safeParseJSON = function (jsonText, defaultValue) {
    try {
        return JSON.parse(jsonText);
    } catch (exception) {
        return defaultValue;
    }
};

/**
 * 안전하게 객체를 json 문자열로 변환
 * @param {object} 변환할 객체
 * @param {any} defaultValue 변환에 실패했을 경우 반환할 값
 * @returns {string} json 문자열
 */
util.safeStringifyJSON = function (jsonObj, defaultValue) {
    try {
        return JSON.stringify(jsonObj);
    } catch (exception) {
        return defaultValue;
    }
};

/**
 * 현재 unix 타임스탬프 반환
 * @returns {number} 타임스탬프
 */
util.getCurrentTimestamp = function () {
    return Math.floor(Date.now() / 1000);
};

/**
 * 사용자 정보 기반 jwt 토큰 생성
 * @param {object} 사용자 정보 객체
 * @returns {String} 생성된 jwt 토큰
 */
util.createToken = function (userInfo) {
    try {
        let token = {};
        let access_token = jwt.sign(
            {
                id: userInfo.id,
                email: userInfo.email,
            },
            config.jwt.secret,
            { expiresIn: config.jwt.accessExp },
        );

        let refresh_token = jwt.sign(
            {
                id: userInfo.id,
                email: userInfo.email,
            },
            config.jwt.secret,
            { expiresIn: config.jwt.refreshExp },
        );

        token.accessToken = access_token;
        token.refreshToken = refresh_token;

        return token;
    } catch (exception) {
        return null;
    }
};

util.extractionToken = function (authorization) {
    try {
        let token = authorization.split(" ")[1];
        return token;
    } catch (exception) {
        return null;
    }
};

util.successValidator = function (result, res) {
    if (!result.success) {
        res.failResponse("QueryError");
        return false;
    }

    return true;
};

util.affectedValidator = function (result, res) {
    if (result.affectedRows === 0) {
        res.failResponse("AffectedEmpty");
        return false;
    }

    return true;
};

JSON.emptyObject = JSON.stringify({});
JSON.emptyArray = JSON.stringify([]);

// 기존 nodejs util과 병합
util = { ...util, ...nodeUtil };

module.exports = util;
