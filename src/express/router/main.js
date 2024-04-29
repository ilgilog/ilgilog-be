/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config } = require("../../util");
const { jwtVerify } = require("../../util/verify");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const schema = config.database.schema.COMMON;

const selectDiaryValidator = [query("date").notEmpty().isString(), validationHandler.handle];

router.get("/diary", selectDiaryValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let result = await mysql.query(
            `
            SELECT id, uid, title, weather, mood, description, DATE_FORMAT(date, '%Y-%m-%d') AS date 
            FROM ilgilog.diary WHERE uid = ? AND date = ?;
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
        return;
    }
});

const insertDiaryValidator = [
    body("date").notEmpty().isString(),
    body("title").notEmpty().isString(),
    body("description").notEmpty().isString(),
    body("weather").notEmpty().isInt().isIn([1, 2, 3, 4, 5]),
    body("mood").notEmpty().isInt().isIn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    validationHandler.handle,
];

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

        let result = await mysql.transactionStatement(async (method) => {
            let insertResult = await method.execute(
                `
                INSERT INTO ${schema}.diary (uid, date, title, description, weather, mood)
                VALUES (?, ?, ?, ?, ?, ?);
                `,
                [userInfo.id, reqData.date, reqData.title, reqData.description, reqData.weather, reqData.mood],
            );

            if (!insertResult.success) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let updateStat = await method.execute(`UPDATE ${schema}.stat SET earned = earned + 30, xp = xp + 1 WHERE uid = ?;`, [userInfo.id]);

            if (!updateStat.success || updateStat.affectedRows === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            return mysql.TRANSACTION.COMMIT;
        });

        if (!result.success) {
            res.failResponse("TransactionError");
            return;
        }

        res.successResponse();
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const updateDiaryValidator = [
    body("date").notEmpty().isString(),
    body("title").optional().isString(),
    body("description").optional().isString(),
    body("weather").optional().isInt().isIn([1, 2, 3, 4, 5]),
    body("mood").optional().isInt().isIn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    validationHandler.handle,
];

router.put("/diary", updateDiaryValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let verify = await mysql.query(`SELECT date FROM ${schema}.diary WHERE uid = ? AND date = ?;`, [userInfo.id, reqData.date]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (verify.rows.length === 0) {
            res.failResponse("DiaryEmpty");
            return;
        }

        let query = `UPDATE ${schema}.diary SET`;
        let queryParams = [];

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
        return;
    }
});

router.get("/point", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let result = await mysql.query(`SELECT uid, point FROM ${schema}.stat WHERE uid = ?;`, [userInfo.id]);

        if (!result.success) {
            res.failResponse("QueryError");
        }

        let data = {};

        data.uid = result.rows[0].uid;
        data.point = result.rows[0].point;

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const calendarValidator = [query("date").notEmpty().isString(), validationHandler.handle];

router.get("/calendar", calendarValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let result = await mysql.query(`SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date FROM ${schema}.diary WHERE uid = ? AND date LIKE ?;`, [userInfo.id, `${reqData.date}%`]);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        if (result.rows.length === 0) {
            res.failResponse("DiaryEmpty");
            return;
        }

        let dataTable = [];

        for (let row of result.rows) {
            dataTable.push(row.date);
        }

        res.successResponse(dataTable);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
