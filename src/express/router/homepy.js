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

router.get("/", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let data = {};

        data.id = userInfo.id;

        let minime = await mysql.query(`SELECT user.mid AS id, minime.url AS url FROM ${schema}.user LEFT JOIN ${schema}.minime ON user.mid = minime.id WHERE user.id = ?;`, [userInfo.id]);

        if (!minime.success) {
            res.failResponse("QueryError");
            return;
        }

        data.minime = minime.rows[0];

        let objet = await mysql.query(
            `
        SELECT home.oid AS id, objet.name AS name, objet.position AS position, objet.price AS price, objet.url AS url, store.status AS status
        FROM ilgilog.home
        LEFT JOIN ilgilog.objet ON home.oid = objet.id
        LEFT JOIN ilgilog.store ON home.uid = store.uid AND home.oid = store.oid
        WHERE home.uid = ?;        
        `,
            [userInfo.id],
        );

        if (!objet.success) {
            res.failResponse("QueryError");
            return;
        }

        if (objet.rows.length === 0) {
            data.objet = "Purchase empty";
        } else {
            data.objet = objet.rows;
        }

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const activationValidator = [body("active").notEmpty().isInt().isIn([1, 0]), validationHandler.handle];

router.put("/activation", activationValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let update = await mysql.execute(`UPDATE ${schema}.user SET active = ? WHERE id = ?;`, [reqData.active, userInfo.id]);

        if (!update.success) {
            res.failResponse("QueryError");
            return;
        }

        if (update.rows.affectedRows === 0) {
            res.failResponse("AffectedEmpty");
            return;
        }

        let result = await mysql.query(`SELECT id, active FROM ${schema}.user WHERE id = ?;`, [userInfo.id]);

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

const objetActiveValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.put("/objet", objetActiveValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let verify = await mysql.query(`SELECT purchase, status FROM ${schema}.store WHERE uid = ? AND oid = ?;`, [userInfo.id, reqData.id]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (verify.rows.length === 0 || verify.rows[0].purchase === 0) {
            res.failResponse("NotPurchaseObjet");
            return;
        }

        if (verify.rows[0].status === 1) {
            res.failResponse("AlreadyActivation");
            return;
        }

        let result = await mysql.execute(`UPDATE ${schema}.store SET status = 1 WHERE uid = ? AND oid =?;`, [userInfo.id, reqData.id]);

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

router.get("/store", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let result = await mysql.query(
            `
            SELECT s.oid AS id, o.name AS name, o.position AS position, o.price AS price, o.url AS url,
                s.status AS status, s.purchase AS purchase
            FROM ${schema}.store AS s
                LEFT JOIN ${schema}.objet AS o
                    ON s.oid = o.id
            WHERE s.uid = ?
            ORDER BY id ASC;
            `,
            [userInfo.id],
        );

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

const objetPurchaseValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.post("/objet", objetPurchaseValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let objetPrice = await mysql.query(`SELECT price FROM ${schema}.objet WHERE id = ?;`, [reqData.id]);

        if (!objetPrice.success) {
            res.failResponse("QueryError");
            return;
        }

        let updateVerify = await mysql.query(`SELECT purchase FROM ${schema}.store WHERE uid =? AND oid = ?;`, [userInfo.id, reqData.id]);

        if (!updateVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (updateVerify.rows[0].purchase === 1) {
            res.failResponse("AlreadyPurchase");
            return;
        }

        let result = await mysql.transactionStatement(async (method) => {
            let updatePurchase = await method.execute(`UPDATE ${schema}.store SET purchase = 1 WHERE uid = ? AND oid = ?;`, [userInfo.id, reqData.id]);

            if (!updatePurchase.success || updatePurchase.affectedRows === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let price = objetPrice.rows[0].price;

            let updateStat = await method.execute(`UPDATE ${schema}.stat SET used = used + ? WHERE uid = ?;`, [price, userInfo.id]);

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

const rankingValidator = [query("type").notEmpty().isString().isIn(["like", "point"]), validationHandler.handle];

router.get("/ranking", rankingValidator, jwtVerify, async (req, res) => {
    let reqData = matchedData(req);
    let userInfo = req.userInfo;

    if (reqData.type === "like") {
    } else if (reqData.type === "point") {
    }
});

const likeValidator = [body("id").notEmpty().isInt(), body("like").notEmpty().isInt().isIn([0, 1]), validationHandler.handle];

router.put("/like", likeValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let verify = await mysql.query(`SELECT uid, lid, status FROM ${schema}.thumbs WHERE uid = ? AND lid = ?;`, [userInfo.id, reqData.id]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (verify.rows.length === 0) {
            let result = await mysql.execute(`INSERT INTO ${schema}.thumbs (uid, lid, status) VALUES (?, ?, ?);`, [userInfo.id, reqData.id, reqData.like]);

            if (!result.success) {
                res.failResponse("QueryError");
                return;
            }
        } else {
            let result = await mysql.execute(`UPDATE ${schema}.thumbs SET status = ? WHERE uid = ? AND lid = ?;`, [reqData.like, userInfo.id, reqData.id]);

            if (!result.success) {
                res.failResponse("QueryError");
                return;
            }

            if (result.affectedRows === 0) {
                res.failResponse("AffectedEmpty");
                return;
            }
        }

        res.successResponse();
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
