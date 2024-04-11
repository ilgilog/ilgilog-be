/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config } = require("../../util");
const jwtVerify = require("../../util/verify");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const schema = config.database.schema.COMMON;

const selectDiaryValidator = [query("date").notEmpty().isString()];

router.get("/diary", selectDiaryValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let result = await mysql.query(
            `SELECT uid, title, weather, mood, description, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM ilgilog.diary WHERE uid = ? AND date = ?;
        `,
            [userInfo.id, reqData.date],
        );

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        if (result.rows.length === 0) {
            res.failResponse("DiaryEmpty");
            return;
        }

        res.successResponse(result.rows);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
    }
});

const insertDiaryValidator = [body("date").notEmpty().isString(), body("title").notEmpty().isString(), body("description").notEmpty().isString(), body("weather").notEmpty().isInt(), body("mood").notEmpty().isInt(), validationHandler.handle];

router.post("/diary", insertDiaryValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let verify = await mysql.query(`SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date FROM ${schema}.diary WHERE uid = ? AND date =?;`, [userInfo.id, reqData.date]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (verify.rows.length > 0) {
            res.failResponse("DuplicateError");
            return;
        }

        let result = await mysql.execute(
            `
        INSERT INTO ${schema}.diary (uid, date, title, description, weather, mood)
        VALUES (?, ?, ?, ?, ?, ?);
        `,
            [userInfo.id, reqData.date, reqData.title, reqData.description, reqData.weather, reqData.mood],
        );

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        let stat = await mysql.execute(`UPDATE ${schema}.stat SET earned = earned + 30, xp = xp + 1 WHERE uid = ?;`, [userInfo.id]);

        if (!stat.success) {
            res.failResponse("QueryError");
            return;
        }

        if (stat.affectedRows === 0) {
            res.failResponse("AffectedEmpty");
            return;
        }

        res.successResponse(result.row);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
    }
});

const updateDiaryValidator = [body("date").notEmpty().isString(), body("title").optional().isString(), body("description").optional().isString(), body("weather").optional().isInt(), body("mood").optional().isInt()];

router.put("/diary", updateDiaryValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let query = "";
        let queryParams = [];

        let verify = await mysql.query(`SELECT date FROM ${schema}.diary WHERE uid = ? AND date = ?;`, [userInfo.id, reqData.date]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (verify.rows.length === 0) {
            res.failResponse("DiaryEmpty");
            return;
        }

        query = `UPDATE ${schema}.diary SET`;

        for (let v in reqData) {
            if (v !== "date") {
                query += ` ${v} = ?,`;
                queryParams.push(reqData[v]);
            }
        }

        query = query.slice(0, -1);
        query += ` WHERE uid = ? AND date = ?;`;
        queryParams.push(userInfo.id, reqData.date);

        let result = await mysql.execute(query, queryParams);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        if (result.affectedRows === 0) {
            res.failResponse("AffectedEmpty");
            return;
        }

        res.successResponse();
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
    }
});

router.get("/point", jwtVerify, async (req, res) => {
    let userInfo = req.userInfo;

    let result = await mysql.query(`SELECT uid, point FROM ${schema}.stat WHERE uid = ?;`, [userInfo.id]);

    if (!result.success) {
        res.failResponse("QueryError");
    }

    res.successResponse(result.rows);
});

const calendarValidator = [query("date").notEmpty().isString(), validationHandler.handle];

router.get("/calendar", calendarValidator, jwtVerify, async (req, res) => {
    let reqData = matchedData(req);
    let userInfo = req.userInfo;

    let days = util.countDay(reqData.date);

    let result = await mysql.query(`SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date FROM ${schema}.diary WHERE uid = ? AND date LIKE ?;`, [userInfo.id, `${reqData.date}%`]);

    if (!result.success) {
        res.failResponse("QueryError");
        return;
    }

    if (result.rows.length === 0) {
        res.failResponse("DiaryEmpty");
        return;
    }

    let writeDays = [];

    for (let row of result.rows) {
        writeDays.push(row.date);
    }

    let dataTable = [];

    for (let i = 1; i <= days; i++) {
        let obj = new Object();
        let date = "";
        if (i < 10) {
            date = reqData.date + `-0${i}`;
        } else {
            date = reqData.date + `-${i}`;
        }

        obj.date = date;
        obj.write = writeDays.includes(date) ? 1 : 0;
        dataTable.push(obj);
    }

    console.log(dataTable);

    res.successResponse(dataTable);
});

module.exports = router;