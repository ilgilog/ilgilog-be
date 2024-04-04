/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");

router.get("/name", async (req, res) => {
    let result = await mysql.query(`SELECT * FROM ilgilog.test;`);

    if (!result.success) {
        res.failResponse(result.rows);
        return;
    }

    res.successResponse(result.rows);
});

module.exports = router;
