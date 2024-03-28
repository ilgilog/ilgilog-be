/*
 *  ilgilog
 */

"use strict";

const log = require("./log");
const util = require("./util");

// ? 순환 의존성 문제로 인해 아래와 같이 처리
module.exports.util = util;
module.exports.log = log;
module.exports.config = require("./config");

// util, log 로드 완료 후 필요한 모듈들을 아래에서 로드
module.exports.httpRequest = require("./httpRequest");
