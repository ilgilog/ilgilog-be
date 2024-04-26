/**
 *  ilgilog
 */

"use strict";

const errorCode = [];

errorCode.errors = {
    ParameterInvalid: { code: 1001, message: "Parameter invalid" },
    TimestampInvalid: { code: 1002, message: "Timestamp invalid" },
    AuthorizationNull: { code: 1003, message: "Authorization null" },
    AuthorizationFailed: { code: 1004, message: "Authorization failed" },
    AuthorizationInvalid: { code: 1005, message: "Authorization invalid" },
    AuthorizationExpired: { code: 1006, message: "Authorization expired" },
    DiaryEmpty: { code: 1007, message: "Diary empty" },
    NotPurchaseObjet: { code: 1008, message: "Not purchase objet" },
    AlreadyPurchase: { code: 1009, message: "Already purchase " },
    AlreadyActivation: { code: 1010, message: "Already activation" },

    NotFound: { code: 2000, message: "Not found" },
    ServerError: { code: 2001, message: "Server error" },

    QueryError: { code: 3000, message: "Database error" },
    AffectedEmpty: { code: 3001, message: "Database error" },
    DuplicateError: { code: 3002, message: "Database error" },
    TransactionError: { code: 3003, message: "Database error" },
};

errorCode.get = function (errorCode) {
    return this.errors[errorCode];
};

module.exports = errorCode;
