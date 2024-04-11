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
const axios = require("axios");
const schema = config.database.schema.COMMON;

router.post("/login", async (req, res) => {
    try {
        const code = req.query.code;

        const kakaoToken = await axios.post("https://kauth.kakao.com/oauth/token", null, {
            params: {
                grant_type: "authorization_code",
                client_id: config.kakao.client_id,
                redirect_url: config.kakao.redirect_url,
                code: code,
                client_secret: config.kakao.client_secret,
            },
        });
        const kakao_token = kakaoToken.data.access_token;

        if (!kakao_token) {
            res.failResponse("ParameterInvalid");
            return;
        }

        kakao_token = kakao_token.split(" ")[1];

        const userData = await axios.get("https://kapi.kakao.com/v2/user/me", {
            headers: {
                Authorization: `Bearer ${kakao_token}`,
            },
        });

        const userInfo = {
            email: userData.data.kakao_account.email,
            nickName: userData.data.kakao_account.profile.nickname,
        };

        let checkUser = await mysql.query(`SELECT id, email FROM ${schema}.user WHERE email = ?;`, [userInfo.email]);

        if (!checkUser.success) {
            res.failResponse("QueryError");
            return;
        }

        let data = {};

        if (checkUser.rows.length === 0) {
            let joinQuery = `INSERT INTO ${schema}.user (email, nickname) VALUES (?, ?);`;
            let joinQueryParams = [userInfo.email, userInfo.nickName];

            let joinUser = await mysql.execute(joinQuery, joinQueryParams);

            if (!joinUser.success) {
                res.failResponse("QueryError");
                return;
            }

            let newPoint = await mysql.execute(`INSERT INTO ${schema}.stat (uid, earned) VALUES (?, ?);`, [joinUser.insertId, 200]);

            if (!newPoint.success) {
                res.failResponse("QueryError");
                return;
            }

            let tokenData = {
                id: joinUser.insertId,
                email: userInfo.email,
            };

            let token = util.createToken(tokenData);

            let verificationQuery = `INSERT INTO ${schema}.verification (uid, token) VALUES (?, ?);`;
            let verificationQueryParams = [joinUser.insertId, token.refresh_token];

            let verificationUser = await mysql.execute(verificationQuery, verificationQueryParams);

            if (!verificationUser.success) {
                res.failResponse("QueryError");
                return;
            }

            data = {
                uid: joinUser.insertId,
                email: userInfo.email,
                nickName: userInfo.nickName,
                firstLogin: 0,
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
            };
        } else {
            let user = await mysql.query(
                `
                SELECT id, email, nickname, first_login
                FROM ${schema}.user
                WHERE email = ?;`,
                [userInfo.email],
            );

            if (!user.success) {
                res.failResponse("QueryError");
                return;
            }

            if (user.rows.first_login === 1) {
                let secondLogin = await mysql.execute(`UPDATE ${schema}.user SET first_login = 0 WHERE id = ?;`, [user.rows.id]);

                if (!secondLogin.success) {
                    res.failResponse("QueryError");
                    return;
                }

                if (secondLogin.affectedRows === 0) {
                    res.failResponse("AffectedEmpty");
                    return;
                }
            }

            let tokenData = {
                id: user.rows.id,
                email: user.rows.email,
            };

            let token = util.createToken(tokenData);

            data = {
                uid: user.rows.id,
                email: user.rows.email,
                nickName: user.rows.nickname,
                firstLogin: user.rows.first_login,
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
            };
        }

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

router.post("/token", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let re_token = util.extractionToken(req.headers.authorization);

        let userData = await mysql.query(`SELECT id, email FROM ${schema}.user WHERE id = ?;`, [userInfo.id]);

        if (!userData.success) {
            res.failResponse("QueryError");
            return;
        }

        let userToken = await mysql.query(`SELECT token FROM ${schema}.verification WHERE uid = ?;`, [userInfo.id]);

        if (!userToken.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userToken.rows[0].token !== re_token) {
            res.failResponse("AuthorizationInvalid");
            return;
        }

        let token = util.createToken(userInfo);

        let tokenUpdate = await mysql.execute(`UPDATE ${schema}.verification SET token = ? WHERE uid = ?;`, [token.refreshToken, userInfo.id]);

        if (!tokenUpdate.success) {
            res.failResponse("QueryError");
            return;
        }

        if (tokenUpdate.affectedRows === 0) {
            res.failResponse("AffectedEmpty");
            return;
        }

        let data = {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
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

router.delete("/secession", async (req, res) => {});

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
            res.failResponse("ServerError");
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
    let dataTable = [];

    let result = await mysql.query(`SELECT id, url FROM ${schema}.minime WHERE type = 1;`);

    if (!result.success) {
        res.failResponse("QeuryError");
        return;
    }

    for (let row of result.rows) {
        dataTable.push({
            id: row.id,
            image: row.url,
        });
    }

    res.successResponse(dataTable);
});

const minimeValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.post("/minime", minimeValidator, jwtVerify, async (req, res) => {
    let reqData = matchedData(req);
    let userInfo = req.userInfo;

    let verify = await mysql.query(`SELECT id FROM ${schema}.minime WHERE id = ?;`, [reqData.id]);

    if (!verify.success) {
        res.failResponse("QueryError");
        return;
    }

    if (verify.rows.length === 0) {
        res.failResponse("ParameterInvalid");
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
});

module.exports = router;
