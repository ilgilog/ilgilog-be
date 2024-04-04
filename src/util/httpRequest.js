/*
 *  G1Live Admin
 */

"use strict";

const httpRequest = {};

const axios = require("axios");
const http = require("http");
const https = require("https");
const { util, log } = require("./index");

const axiosObj = axios.create({
    responseType: "json",
    responseEncoding: "utf8",

    // ? keep-alive 설정으로 재사용하여 리소스 사용 및 성능 최적화
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
});

httpRequest.METHOD = {
    GET: 0,
    POST: 1,
    // PUT: 2,
    // DELETE: 3,
};

/**
 * Rest API 통신 함수
 * @param {httpRequest.METHOD} method HTTP method
 * @param {string} url 요청 url
 * @param {any} data 데이터
 * @param {object} options 기타 옵션
 * @returns {object} 성공, 실패 값
 */
httpRequest.request = async function (method, url, data, options = {}) {
    try {
        let res;

        // HTTP method에 따라 분기 처리
        if (method === this.METHOD.GET) {
            res = await axiosObj.get(url, {
                params: new URLSearchParams(data),
                ...options,
            });
        } else if (method === this.METHOD.POST) {
            res = await axiosObj.post(url, data, {
                ...options,
            });
        }

        return {
            success: true,
            data: res.data,
        };
    } catch (exception) {
        // Timeout 일때
        if (exception.code === "ECONNABORTED") {
            log.warn(`${Object.keys(this.METHOD)[method]} ${url} > TIMEOUT (exception: ${exception.message})`);
        } else {
            // 요청이 전송되었고 서버가 2xx 외의 상태 코드로 응답
            if (exception.response) {
                log.error(`HttpRequest - ${Object.keys(this.METHOD)[method]} ${url} > ${exception.response.status} (exception: ${exception.message})`);
            }
            // 요청이 전송되었지만 서버가 응답하지 않음 (like timeout?)
            else if (exception.request) {
                log.error(`HttpRequest - ${Object.keys(this.METHOD)[method]} ${url} > No response (exception: ${exception.message})`);
            }
            // 그 외의 오류일 때
            else {
                log.error(`HttpRequest - ${Object.keys(this.METHOD)[method]} ${url} > (exception: ${exception.message})`);
            }
        }

        return {
            success: false,
        };
    }
};

module.exports = httpRequest;
