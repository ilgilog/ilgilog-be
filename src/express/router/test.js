/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { matchedData, validationResult, body, query } = require("express-validator");
const config = require("../../util/config");

const schema = config.database.schema.COMMON;

router.get("/name", async (req, res) => {
    let result = await mysql.query(`SELECT * FROM ${schema}.test;`);

    if (!result.success) {
        res.failResponse("ServerError");
        return;
    }

    res.successResponse(result.rows);
});

module.exports = router;
