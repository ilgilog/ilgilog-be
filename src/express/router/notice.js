/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config } = require("../../util");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const schema = config.database.schema.COMMON;

router.get("/", async (req, res) => {
    try {
        let result = await mysql.query(`SELECT id, title, description, new, DATE_FORMAT(reg_date, '%Y-%m-%d') AS date FROM ${schema}.notice;`);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        res.successResponse(result.rows);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const addValidator = [body("title").notEmpty().isString(), body("description").notEmpty().isString(), validationHandler.handle];

router.post("/", addValidator, async (req, res) => {
    try {
        let reqData = matchedData(req);

        let result = await mysql.execute(`INSERT INTO ${schema}.notice (title, description) VALUES (?, ?);`, [reqData.title, reqData.description]);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        res.successResponse();
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const modifyValidator = [body("id").notEmpty().isInt(), body("title").optional().isString(), body("description").optional().isString(), validationHandler.handle];

router.put("/", modifyValidator, async (req, res) => {
    try {
        let reqData = matchedData(req);

        let verify = await mysql.query(`SELECT id FROM ${schema}.notice WHERE id = ?;`, [reqData.id]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (verify.rows.length === 0 || Object.keys(reqData).length < 2) {
            res.failResponse("ParameterInvalid");
            return;
        }

        let query = `UPDATE ${schema}.notice SET`;
        let queryParams = [];

        for (let v in reqData) {
            if (v !== "id") {
                query += ` ${v} = ?,`;
                queryParams.push(reqData[v]);
            }
        }

        query = query.slice(0, -1);
        query += ` WHERE id = ?;`;
        queryParams.push(reqData.id);

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

const deleteValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.delete("/", deleteValidator, async (req, res) => {
    try {
        let reqData = matchedData(req);

        let verify = await mysql.query(`SELECT id FROM ${schema}.notice WHERE id =?;`, [reqData.id]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (verify.rows.length === 0) {
            res.failResponse("NotExistNotice");
            return;
        }

        let result = await mysql.transactionStatement(async (method) => {
            let deleteresult = await method.execute(`DELETE FROM ${schema}.notice WHERE id = ?;`, [reqData.id]);

            if (!deleteresult.success) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            return mysql.TRANSACTION.COMMIT;
        });

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        if (result.commit) {
            res.successResponse();
            return;
        } else {
            res.failResponse("TransactionError");
            return;
        }
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
