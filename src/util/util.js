/**
 *  ilgilog
 */

"use strict";

let util = {};

const moment = require("moment-timezone");
const nodeUtil = require("util");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");
const glob = require("glob");

util.sleep = (ms) => new Promise((resolve) => setTimeout(resolvem, ms));

/**
 * 지정된 경로에 파일이 존재하는지 여부를 반환
 * @param {string} location 파일 경로
 * @returns {boolean} 존재 여부
 */
util.isFileExists = async function (location) {
    try {
        let stats = await fs.stat(location);

        return stats && stats.isFile();
    } catch (exception) {
        return false;
    }
};

/**
 * 지정된 경로에 폴더가 존재하는지 여부를 반환
 * @param {string} location 폴더 경로
 * @returns {boolean} 존재 여부
 */
util.isDirectoryExists = async function (location) {
    try {
        let stats = await fs.stat(location);

        return stats && stats.isDirectory();
    } catch (exception) {
        return false;
    }
};

/**
 * 지정된 경로에 모든 하위 파일들을 반환
 * @param {string} location 폴더 경로
 * @param {boolean} useFullPath 전체 경로 사용 여부
 * @returns {string[]} 파일 리스트
 * ! 하위 폴더는 반환하지 않음
 */
util.getFilesInDirectory = async function (location, useFullPath) {
    try {
        let result = [];
        let fileList = await fs.readdir(location);

        for (let v of fileList) {
            if (await this.isFileExists(path.join(location, v))) {
                result.push(useFullPath ? path.join(location, v) : v);
            }
        }
        return result;
    } catch (exception) {
        return null;
    }
};

/**
 * 지정된 경로의 모든 하위 파일들을 반환 (GLOB 사용)
 * @param {string} location 폴더 경로
 * @param {object} options glob 옵션
 * @returns {string[]} 파일 리스트
 */
util.getFilesInDirectoryDeep = async function (location, options = {}) {
    try {
        let files = await glob.glob(location, options);

        return files;
    } catch (exception) {
        return null;
    }
};

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
 * 오브젝트의 1 depth 키를 필터링
 * @param {object} obj 오브젝트
 * @param {array} keys 키 배열
 * @returns {object} 필터링된 오브젝트
 */
util.filterObject = function (obj, keys) {
    let newObj = {};

    for (let k of keys) {
        if (obj.hasOwnProperty(k)) {
            newObj[k] = obj[k];
        }
    }

    return newObj;
};

/**
 * 오브젝트에서 undefind 값인 key 제거
 * @param {object} obj 오브젝트
 */
util.removeUndefindValue = function (obj) {
    let newObj = {};

    for (let k in obj) {
        if (obj[k] !== undefined) newObj[k] = obj[k];
    }

    return newObj;
};

/**
 * 객체가 비어있는지 여부를 반환
 * @param {object} obj 객체
 * @returns {boolean} 객체가 비어있는지 여부
 */
util.isEmptyObject = function (obj) {
    return obj.constructor === Object && Object.keys(obj).length === 0;
};

/**
 * 범위 안의 랜덤 숫자를 반환
 * @param {number} min 최소값
 * @param {number} max 최대값
 * @returns {number} 랜덤값
 */
Math.randomRange = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 현재 unix 타임스탬프 반환
 * @returns {number} 타임스탬프
 */
util.getCurrentTimestamp = function () {
    return Math.floor(Date.now() / 1000);
};

/**
 * 배열 안의 랜덤 요소를 반환
 * @param {array} arr 배열
 * @returns {array} 랜덤 요소
 */
util.randomArray = function (arr) {
    return arr[Math.randomRange(0, arr.length)];
};

/**
 * 랜덤 값 반환
 * @returns {string} 32자리의 랜덤한 값
 */
util.generateKey = function () {
    let id = uuid.v4();

    return crypto
        .createHash("md5")
        .update(id + config.keySalt)
        .digest("hex");
};

/**
 * URL 합치기
 * @param {string} baseURL base URL
 * @param {string} relativeURL 추가할 URL
 * @returns {string} URL
 * https://stackoverflow.com/questions/16301503/can-i-use-requirepath-join-to-safely-concatenate-urls
 */
util.combineURLs = function (baseURL, relativeURL) {
    return relativeURL ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
};

/**
 * URL 합치기
 * @param {string} baseURL base URL
 * @param {string} relativeURL 추가할 URL
 * @returns {string} URL
 * https://stackoverflow.com/questions/16301503/can-i-use-requirepath-join-to-safely-concatenate-urls
 */
util.combineURL = function (baseURL, ...relativeURLs) {
    let url = baseURL.replace(/\/+$/, "");

    for (let v of relativeURLs) {
        url += "/" + v.replace(/^\/+/, "");
    }

    return url;
};

JSON.emptyObject = JSON.stringify({});
JSON.emptyArray = JSON.stringify([]);

// 기존 nodejs util과 병합
util = { ...util, ...nodeUtil };

module.exports = util;
