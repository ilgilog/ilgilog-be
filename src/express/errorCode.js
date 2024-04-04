/**
 *  ilgilog
 */

"use strict";

const errorCode = [];

errorCode.errors = {
    ParameterInvalid: { code: 1001, message: "Parameter invalid" },
    TimestampInvalid: { code: 1002, message: "Timestamp invalid" },
    AuthorizationInvalid: { code: 1003, message: "Authorization invalid" },
    AuthorizationExpired: { code: 1004, message: "Authorization expired" },
    DataInvalid: { code: 1005, message: "Data invalid" },

    // Account
    UnknownAccount: { code: 1006, message: "Unknown account" },

    NotFound: { code: 2000, message: "Not Found" },
    ServerError: { code: 2001, message: "Server error" },
};

errorCode.get = function (errorCode) {
    return this.errors[errorCode];
};

module.exports = errorCode;
