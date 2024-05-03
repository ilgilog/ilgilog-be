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

const homepyValidator = [query("id").optional().isInt(), validationHandler.handle];

router.get("/", homepyValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;
        let data = {};

        if (reqData.id) {
            data.id = Number(reqData.id);

            let thumbs = await mysql.query(`SELECT SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS count FROM thumbs WHERE lid = ?;`, [data.id]);
            let point = await mysql.query(`SELECT used FROM ${schema}.stat WHERE uid = ?;`, [data.id]);
            let status = await mysql.query(`SELECT status FROM ${schema}.thumbs WHERE uid = ? AND lid = ?;`, [userInfo.id, data.id]);

            if (!thumbs.success || !point.success || !status.success) {
                res.failResponse("QueryError");
                return;
            }

            data.like = Number(thumbs.rows[0].count);
            data.point = point.rows[0].used;

            if (status.rows.length === 0) {
                data.status = 0;
            } else {
                data.status = status.rows[0].status;
            }
        } else {
            data.id = userInfo.id;
        }

        let minime = await mysql.query(`SELECT user.mid AS id, minime.url AS url FROM ${schema}.user LEFT JOIN ${schema}.minime ON user.mid = minime.id WHERE user.id = ?;`, [data.id]);

        if (!minime.success) {
            res.failResponse("QueryError");
            return;
        }

        data.minime = minime.rows[0];

        let objet = await mysql.query(
            `
        SELECT home.oid AS id, objet.name AS name, objet.position AS position, objet.price AS price, objet.url AS url, store.status AS status
        FROM ${schema}.home
        LEFT JOIN ${schema}.objet ON home.oid = objet.id
        LEFT JOIN ${schema}.store ON home.uid = store.uid AND home.oid = store.oid
        WHERE home.uid = ?;        
        `,
            [data.id],
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
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let dataTable = [];

        if (reqData.type === "like") {
            let likeRank = await mysql.query(
                `
                SELECT id AS uid, nickname, score AS count
                FROM ${schema}.user
                WHERE active = 1
                ORDER BY score DESC;
                `,
            );

            if (!likeRank.success) {
                res.failResponse("QueryError");
                return;
            }

            if (likeRank.rows.length === 0) {
                res.failResponse("EmptyActiveUser");
            }

            let lidData = await mysql.query(`SELECT lid FROM ${schema}.thumbs WHERE uid = ? AND status = 1;`, [userInfo.id]);

            if (!lidData.success) {
                res.failResponse("QueryError");
                return;
            }

            let lid = lidData.rows.map((item) => item.lid);

            for (let i = 0; i < likeRank.rows.length; i++) {
                let data = {};

                data.uid = likeRank.rows[i].uid;
                data.nickName = likeRank.rows[i].nickname;
                data.like = Number(likeRank.rows[i].count);

                if (lid.includes(likeRank.rows[i].uid)) {
                    data.likeStatus = 1;
                } else {
                    data.likeStatus = 0;
                }

                if (i < 3) {
                    let minimeData = await mysql.query(`SELECT user.mid AS id, minime.url AS url FROM ${schema}.user LEFT JOIN ${schema}.minime ON user.mid = minime.id WHERE user.id = ?;`, [likeRank.rows[i].uid]);
                    let objetData = await mysql.query(
                        `
                        SELECT home.oid AS id, objet.name AS name, objet.position AS position, objet.price AS price, objet.url AS url, store.status AS status
                        FROM ${schema}.home
                        LEFT JOIN ${schema}.objet ON home.oid = objet.id
                        LEFT JOIN ${schema}.store ON home.uid = store.uid AND home.oid = store.oid
                        WHERE home.uid = ?; 
                        `,
                        [likeRank.rows[i].uid],
                    );

                    if (!minimeData.success || !objetData.success) {
                        throw new Error("QueryError");
                    }
                    data.minime = minimeData.rows[0];
                    data.objet = objetData.rows;
                }

                dataTable.push(data);
            }
        } else if (reqData.type === "point") {
            let pointRank = await mysql.query(
                `
                SELECT u.id AS uid, u.nickname AS nickname, s.used AS point, RANK() OVER (ORDER BY s.used DESC) AS ranking
                FROM ${schema}.stat s LEFT JOIN ${schema}.user AS u ON s.uid = u.id
                WHERE u.active = 1
                ORDER BY ranking ASC;
                `,
            );

            if (!pointRank.success) {
                res.failResponse("QueryError");
                return;
            }

            for (let i = 0; i < pointRank.rows.length; i++) {
                let data = {};

                data.uid = pointRank.rows[i].uid;
                data.nickName = pointRank.rows[i].nickname;
                data.point = pointRank.rows[i].point;

                if (i < 3) {
                    let minimeData = await mysql.query(`SELECT user.mid AS id, minime.url AS url FROM ${schema}.user LEFT JOIN ${schema}.minime ON user.mid = minime.id WHERE user.id = ?;`, [pointRank.rows[i].uid]);
                    let objetData = await mysql.query(
                        `
                        SELECT home.oid AS id, objet.name AS name, objet.position AS position, objet.price AS price, objet.url AS url, store.status AS status
                        FROM ${schema}.home
                        LEFT JOIN ${schema}.objet ON home.oid = objet.id
                        LEFT JOIN ${schema}.store ON home.uid = store.uid AND home.oid = store.oid
                        WHERE home.uid = ?; 
                        `,
                        [pointRank.rows[i].uid],
                    );

                    if (!minimeData.success || !objetData.success) {
                        throw new Error("QueryError");
                    }
                    data.minime = minimeData.rows[0];
                    data.objet = objetData.rows;
                }

                dataTable.push(data);
            }
        }

        res.successResponse(dataTable);
    } catch (exception) {
        console.log(exception);
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const likeValidator = [body("id").notEmpty().isInt(), body("like").notEmpty().isInt().isIn([0, 1]), validationHandler.handle];

router.put("/like", likeValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let idVerify = await mysql.query(`SELECT id, score FROM ${schema}.user WHERE id = ?;`, [reqData.id]);

        if (!idVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (idVerify.rows.length === 0) {
            res.failResponse("ParameterInvalid");
            return;
        }

        let verify = await mysql.query(`SELECT uid, lid, status FROM ${schema}.thumbs WHERE uid = ? AND lid = ?;`, [userInfo.id, reqData.id]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }
        let result = await mysql.transactionStatement(async (method) => {
            if (verify.rows.length === 0) {
                let result = await method.execute(`INSERT INTO ${schema}.thumbs (uid, lid, status) VALUES (?, ?, ?);`, [userInfo.id, reqData.id, reqData.like]);

                if (!result.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }
            } else {
                let result = await method.execute(`UPDATE ${schema}.thumbs SET status = ? WHERE uid = ? AND lid = ?;`, [reqData.like, userInfo.id, reqData.id]);

                if (!result.success || result.affectedRows === 0) {
                    return mysql.TRANSACTION.ROLLBACK;
                }
            }
            let scoreUpdate;
            if (reqData.like === 0) {
                if (idVerify.rows[0].score > 0) {
                    scoreUpdate = await method.execute(`UPDATE ${schema}.user SET score = score - 1 WHERE id = ?;`, [reqData.id]);
                }
            } else {
                scoreUpdate = await method.execute(`UPDATE ${schema}.user SET score = score + 1 WHERE id = ?;`, [reqData.id]);
            }

            if (!scoreUpdate.success || scoreUpdate.affectedRows === 0) {
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
