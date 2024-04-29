/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config } = require("../../util");
const { jwtVerify, refreshVerify } = require("../../util/verify");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const axios = require("axios");
const schema = config.database.schema.COMMON;

router.post("/login", async (req, res) => {
    try {
        let code = req.headers.authorization;

        code = code.split(" ")[1];

        let kakaoToken = await axios.post("https://kauth.kakao.com/oauth/token", null, {
            params: {
                grant_type: "authorization_code",
                client_id: config.kakao.client_id,
                redirect_uri: config.kakao.redirect_uri,
                code: code,
            },
        });

        let kakao_token = kakaoToken.data.access_token;

        if (!kakao_token) {
            res.failResponse("ParameterInvalid");
            return;
        }

        let userData = await axios.get("https://kapi.kakao.com/v2/user/me", {
            headers: {
                Authorization: `Bearer ${kakao_token}`,
            },
        });

        let userInfo = {
            email: userData.data.kakao_account.email,
            nickName: userData.data.kakao_account.profile.nickname,
        };

        let checkUser = await mysql.query(`SELECT id, email FROM ${schema}.user WHERE email = ?;`, [userInfo.email]);

        if (!checkUser.success) {
            res.failResponse("QueryError");
            return;
        }

        let data = {};
        let result = await mysql.transactionStatement(async (method) => {
            if (checkUser.rows.length === 0) {
                let joinUser = await method.execute(`INSERT INTO ${schema}.user (email, nickname) VALUES (?, ?);`, [userInfo.email, userInfo.nickName]);

                if (!joinUser.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let selectID = await method.query(`SELECT id FROM ${schema}.user WHERE email = ?;`, [userInfo.email]);

                if (!selectID.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let tokenData = {
                    id: selectID.rows[0].id,
                    email: userInfo.email,
                };

                let token = util.createToken(tokenData);

                let verificationUser = await method.execute(`INSERT INTO ${schema}.verification (uid, token) VALUES (?, ?);`, [tokenData.id, token.refreshToken]);

                if (!verificationUser.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                data = {
                    id: tokenData.id,
                    email: userInfo.email,
                    nickName: userInfo.nickName,
                    firstLogin: 1,
                    access_token: token.accessToken,
                    refresh_token: token.refreshToken,
                };

                let point = await method.execute(`INSERT INTO ${schema}.stat (uid, earned) VALUES (?, ?);`, [tokenData.id, 200]);

                if (!point.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }
            } else {
                let user = await method.query(`SELECT id, email, nickname, first_login FROM ${schema}.user WHERE email = ?;`, [userInfo.email]);

                if (!user.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                if (user.rows[0].first_login === 1) {
                    let secondLogin = await method.execute(`UPDATE ${schema}.user SET first_login = 0 WHERE id = ?;`, [user.rows[0].id]);

                    if (!secondLogin.success || secondLogin.affectedRows === 0) {
                        return mysql.TRANSACTION.ROLLBACK;
                    }
                }

                let tokenData = {
                    id: user.rows[0].id,
                    email: user.rows[0].email,
                };

                let token = util.createToken(tokenData);

                let tokenVerify = await method.query(`SELECT uid FROM ${schema}.verification WHERE uid = ?;`, [user.rows[0].id]);

                let verificationUser;

                if (tokenVerify.rows.length === 0 || !tokenVerify.rows) {
                    verificationUser = await method.execute(`INSERT INTO ${schema}.verification (uid, token) VALUES (?, ?);`, [user.rows[0].id, token.refreshToken]);
                } else {
                    verificationUser = await method.execute(`UPDATE ${schema}.verification SET token = ? WHERE uid = ?;`, [token.refreshToken, user.rows[0].id]);
                }

                if (!verificationUser.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                data = {
                    id: user.rows[0].id,
                    email: user.rows[0].email,
                    nickName: user.rows[0].nickname,
                    firstLogin: 0,
                    access_token: token.accessToken,
                    refresh_token: token.refreshToken,
                };
            }

            return mysql.TRANSACTION.COMMIT;
        });

        if (!result.success || !result.commit) {
            res.failResponse("TransactionError");
            return;
        }

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

router.post("/token", refreshVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let re_token = util.extractionToken(req.headers.authorization);

        let userVerify = await mysql.query(`SELECT id, email FROM ${schema}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        let tokenVerify = await mysql.query(`SELECT token FROM ${schema}.verification WHERE uid = ?;`, [userInfo.id]);

        if (!tokenVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (tokenVerify.rows[0].token !== re_token || tokenVerify.rows.length === 0) {
            res.failResponse("AuthorizationInvalid");
            return;
        }

        let token = util.createToken(userInfo);

        let tokenUpdate = await mysql.execute(`UPDATE ${schema}.verification SET token = ?, exp_date = DATE_ADD(NOW(), INTERVAL ${config.jwt.timeInterval}) WHERE uid = ?;`, [token.refreshToken, userInfo.id]);

        if (!tokenUpdate.success) {
            res.failResponse("QueryError");
            return;
        }

        if (tokenUpdate.affectedRows === 0) {
            res.failResponse("AffectedEmpty");
            return;
        }

        let data = {
            access_token: token.accessToken,
            refresh_token: token.refreshToken,
        };

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

// router.post("/logout", jwtVerify, async (req, res) => {
//     try {
//         let userInfo = req.userInfo;

//         let result = await mysql.execute(`UPDATE ${schema}.user SET first_login = 0 WHERE id = ?;`, [userInfo.id]);

//         if (!result.success) {
//             res.failResponse("QueryError");
//             return;
//         }

//         if (result.affectedRows === 0) {
//             res.failResponse("AffectedEmpty");
//             return;
//         }

//         res.successResponse();
//     } catch (exception) {
//         log.error(exception);
//         res.failResponse("ServerError");
//         return;
//     }
// });

router.delete("/secession", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let result = await mysql.transactionStatement(async (method) => {
            let deleteresult = await method.execute(
                `
                DELETE FROM ${schema}.user WHERE id = ? AND email = ?;
                `,
                [userInfo.id, userInfo.email],
            );

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

router.get("/profile", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let result = await mysql.query(
            `
        SELECT user.id, user.email, user.nickname, stat.point
        FROM ${schema}.user LEFT JOIN ${schema}.stat ON user.id = stat.uid
        WHERE user.id = ?`,
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

const profileValidator = [body("nickName").notEmpty().isString().isLength({ min: 1, max: 45 }), validationHandler.handle];

router.put("/profile", profileValidator, jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let reqData = matchedData(req);

        let result = await mysql.execute(`UPDATE ${schema}.user SET nickname = ? WHERE id = ?;`, [reqData.nickName, userInfo.id]);

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

router.get("/minime", jwtVerify, async (req, res) => {
    try {
        let dataTable = [];

        let result = await mysql.query(`SELECT id, url FROM ${schema}.minime WHERE type = 1;`);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        for (let row of result.rows) {
            dataTable.push({
                id: row.id,
                image: row.url,
            });
        }

        res.successResponse(dataTable);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const minimeValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.post("/minime", minimeValidator, jwtVerify, async (req, res) => {
    try {
        let reqData = matchedData(req);
        let userInfo = req.userInfo;

        let verify = await mysql.query(`SELECT id FROM ${schema}.minime WHERE id = ?;`, [reqData.id]);

        if (!verify.success) {
            res.failResponse("QueryError");
            return;
        }

        let result = await mysql.execute(`UPDATE ${schema}.user SET mid = ? WHERE id = ?;`, [reqData.id, userInfo.id]);

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

module.exports = router;
