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
const { jwt } = require("../../util/config");
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
            data.objet = [];
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

router.get("/activation", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let result = await mysql.query(`SELECT active FROM ${schema}.user WHERE id = ?;`, [userInfo.id]);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }
        let data = {};

        data.id = userInfo.id;
        data.activation = result.rows[0].active;

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("QueryError");
        return;
    }
});

const activationValidator = [body("activation").notEmpty().isInt().isIn([1, 0]), validationHandler.handle];

router.put("/activation", activationValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let update = await mysql.execute(`UPDATE ${schema}.user SET active = ? WHERE id = ?;`, [reqData.activation, userInfo.id]);

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

        let data = {};

        data.id = userInfo.id;
        data.activation = result.rows[0].active;

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const objetActiveValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.put("/objet/apply", objetActiveValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let purchaseVerify = await mysql.query(
            `
            SELECT s.purchase, s.status, o.position 
            FROM ${schema}.store AS s LEFT JOIN ${schema}.objet AS o ON s.oid = o.id 
            WHERE uid = ? AND oid = ?;
            `,
            [userInfo.id, reqData.id],
        );

        if (!purchaseVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (purchaseVerify.rows.length === 0 || purchaseVerify.rows[0].purchase === 0) {
            res.failResponse("NotPurchaseObjet");
            return;
        }

        let statusVerify = await mysql.query(`SELECT id FROM ${schema}.home WHERE uid = ? AND oid = ?;`, [userInfo.id, reqData.id]);

        if (!statusVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (purchaseVerify.rows[0].status === 1 || statusVerify.rows.length > 0) {
            res.failResponse("AlreadyActivation");
            return;
        }

        let result = await mysql.transactionStatement(async (method) => {
            let releaseDelete = await method.execute(`DELETE FROM ${schema}.home WHERE uid = ? AND oid IN (SELECT id FROM objet WHERE position = ? AND id <> ?);`, [userInfo.id, purchaseVerify.rows[0].position, reqData.id]);
            let releaseUpdate = await method.execute(`UPDATE ${schema}.store SET status = 0 WHERE uid =? AND oid IN (SELECT id FROM objet WHERE position = ? AND id <> ?);`, [userInfo.id, purchaseVerify.rows[0].position, reqData.id]);

            if (!releaseDelete.success || !releaseUpdate.success || releaseUpdate.affectedRows === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let activeInsert = await method.execute(`INSERT INTO ${schema}.home (uid, oid) VALUES (?, ?);`, [userInfo.id, reqData.id]);
            let activeUpdate = await method.execute(`UPDATE ${schema}.store SET status =1 WHERE uid = ? AND oid = ?;`, [userInfo.id, reqData.id]);

            if (!activeInsert.success || !activeUpdate.success || activeUpdate.affectedRows === 0) {
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

// const objetActiveValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

// router.put("/objet/apply", objetActiveValidator, jwtVerify, async (req, res) => {
//     try {
//         let reqData = matchedData(req);
//         let userInfo = req.userInfo;

//         let verify = await mysql.query(
//             `
//             SELECT s.purchase, s.status, o.position
//             FROM ${schema}.store AS s LEFT JOIN ${schema}.objet AS o ON s.oid = o.id
//             WHERE uid = ? AND oid = ?;
//             `,
//             [userInfo.id, reqData.id],
//         );

//         if (!verify.success) {
//             res.failResponse("QueryError");
//             return;
//         }

//         if (verify.rows.length === 0 || verify.rows[0].purchase === 0) {
//             res.failResponse("NotPurchaseObjet");
//             return;
//         }

//         if (verify.rows[0].status === 1) {
//             res.failResponse("AlreadyActivation");
//             return;
//         }

//         let result = await mysql.transactionStatement(async (method) => {
//             let applyVerify = await method.query(
//                 `
//                 SELECT id, status FROM ${schema}.store WHERE uid = ? AND oid IN (
//                     SELECT id FROM objet WHERE position = ? AND id <> ?);
//                 `,
//                 [userInfo.id, verify.rows[0].position, reqData.id],
//             );

//             if (!applyVerify.success || applyVerify.rows.length === 0) {
//                 return mysql.TRANSACTION.ROLLBACK;
//             }

//             let statusFlag = 0;

//             for (let row of applyVerify.rows) {
//                 if (row.status === 0) {
//                     continue;
//                 } else {
//                     let release = await method.execute(`UPDATE ${schema}.store SET status = 0 WHERE id = ?;`, [row.id]);

//                     if (!release.success || release.affectedRows === 0) {
//                         return mysql.TRANSACTION.ROLLBACK;
//                     }
//                 }

//                 statusFlag = 1;
//             }

//             if (statusFlag) {
//                 let apply = await method.execute(`UPDATE ${schema}.store SET status = 1 WHERE uid =? AND oid = ?;`, [userInfo.id, reqData.id]);

//                 if (!apply.success || apply.affectedRows === 0) {
//                     return mysql.TRANSACTION.ROLLBACK;
//                 }
//             }

//             return mysql.TRANSACTION.COMMIT;
//         });

//         if (!result.success) {
//             res.failResponse("QueryError");
//             return;
//         }

//         if (result.commit) {
//             res.successResponse();
//         } else {
//             res.failResponse("TransactionError");
//             return;
//         }
//     } catch (exception) {
//         log.error(exception);
//         res.failResponse("ServerError");
//         return;
//     }
// });

const objetReleaseValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.put("/objet/release", objetReleaseValidator, jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let reqData = matchedData(req);

        let result = await mysql.transactionStatement(async (method) => {
            let releaseUpdate = await method.execute(`UPDATE ${schema}.store SET status = 0 WHERE uid = ? AND oid = ?;`, [userInfo.id, reqData.id]);
            let releaseDelete = await method.execute(`DELETE FROM ${schema}.home WHERE uid = ? AND oid = ?;`, [userInfo.id, reqData.id]);

            if (!releaseDelete.success || !releaseUpdate.success || releaseUpdate.affectedRows === 0) {
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

        let objetInfo = await mysql.query(`SELECT price, name FROM ${schema}.objet WHERE id = ?;`, [reqData.id]);

        if (!objetInfo.success) {
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

        let userPoint = await mysql.query(`SELECT point FROM ${schema}.stat WHERE uid =?;`, [userInfo.id]);

        if (!userPoint.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userPoint.rows[0].point - objetInfo.rows[0].price < 0) {
            res.failResponse("NotEnoughPoint");
            return;
        }

        let result = await mysql.transactionStatement(async (method) => {
            let updatePurchase = await method.execute(`UPDATE ${schema}.store SET purchase = 1 WHERE uid = ? AND oid = ?;`, [userInfo.id, reqData.id]);

            if (!updatePurchase.success || updatePurchase.affectedRows === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let updateStat = await method.execute(`UPDATE ${schema}.stat SET used = used + ? WHERE uid = ?;`, [objetInfo.rows[0].price, userInfo.id]);

            if (!updateStat.success || updateStat.affectedRows === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let history = await method.execute(`INSERT INTO ${schema}.history (uid, oid, o_name, price) VALUES (?, ?, ?, ?);`, [userInfo.id, reqData.id, objetInfo.rows[0].name, objetInfo.rows[0].price]);

            if (!history.success) {
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
