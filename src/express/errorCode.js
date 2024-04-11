/**
 *  ilgilog
 */

"use strict";

const errorCode = [];

errorCode.errors = {
    ParameterInvalid: { code: 1001, message: "Parameter invalid" },
    TimestampInvalid: { code: 1002, message: "Timestamp invalid" },
    AuthorizationNull: { code: 1003, message: "Authorization Null" },
    AuthorizationFailed: { code: 1004, message: "Authorization Failed" },
    AuthorizationInvalid: { code: 1005, message: "Authorization invalid" },
    AuthorizationExpired: { code: 1006, message: "Authorization expired" },
    DiaryEmpty: { code: 1007, message: "Diary empty" },
    NotPurchaseObjet: { code: 1008, message: "Not purchase objet" },
    AlreadyPurchase: { code: 1009, message: "Already purchase " },
    AlreadyActivation: { code: 1010, message: "Already activation" },

    NotFound: { code: 2000, message: "Not Found" },
    ServerError: { code: 2001, message: "Server error" },

    QueryError: { code: 3000, message: "Query error" },
    AffectedEmpty: { code: 3001, message: "AffectedEmpty" },
    DuplicateError: { code: 3002, message: "Duplicate error" },
};

errorCode.get = function (errorCode) {
    return this.errors[errorCode];
};

module.exports = errorCode;
