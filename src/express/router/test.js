/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { matchedData, validationResult, body, query } = require("express-validator");
const config = require("../../util/config");
const validationHandler = require("../validationHandler");

const schema = config.database.schema.COMMON;

const testValidator = [query("uid").notEmpty().isInt(), validationHandler.handle];

router.get("/name", testValidator, async (req, res) => {
    let result = await mysql.query(`SELECT * FROM ${schema}.test;`);

    if (!result.success) {
        res.failResponse("ServerError");
        return;
    }

    res.successResponse(result.rows);
});

module.exports = router;
