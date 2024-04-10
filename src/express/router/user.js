/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { matchedData, validationResult, body, query } = require("express-validator");
const util = require("../../util/util");
const log = require("../../util/log");
const config = require("../../util/config");
const axios = require("axios");
const validationHandler = require("../validationHandler");
const jwtVerify = require("../../util/verify");

const schema = config.database.schema.COMMON;

router.post("/login", async (req, res) => {
    try {
        // const code = req.query.code;

        // const kakaoToken = await axios.post("https://kauth.kakao.com/oauth/token", null, {
        //     params: {
        //         grant_type: "authorization_code",
        //         client_id: config.kakao.client_id,
        //         redirect_url: config.kakao.redirect_url,
        //         code: code,
        //         client_secret: config.kakao.client_secret,
        //     },
        // });
        // const kakao_token = kakaoToken.data.access_token;

        let kakao_token = req.headers.authorization;

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

        //db 기존 회원 조회 후 토큰 발행하고 넘겨주는 로직 작성해야함.
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
                firstLogin: 1,
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

            let tokenData = {
                id: user.rows[0].id,
                email: user.rows[0].email,
            };

            let token = util.createToken(tokenData);

            data = {
                uid: user.rows[0].id,
                email: user.rows[0].email,
                nickName: user.rows[0].nickname,
                firstLogin: user.rows[0].first_login,
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

router.post("/token", jwtVerify, async (req, res, next) => {
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

router.post("/logout", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let result = await mysql.execute(`UPDATE ${schema}.user SET first_login = 0 WHERE id = ?;`, [userInfo.id]);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        if (result.affectedRows === 0) {
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

const profileValidator = [body("nickName").notEmpty().isString().isLength({ min: 1, max: 45 })];

router.put("/profile", profileValidator, jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let data = matchedData(data);

        let result = await mysql.execute(`UPDATE ${schema}.user SET nickname = ? WHERE id = ?;`, [data.nickName, userInfo.id]);

        if (!result.success) {
            res.failResponse("QueryError");
            return;
        }

        if (result.affectedRows === 0) {
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

const minimeValidator = [body("id").notEmpty().isInt()];

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
        res.failResponse("QueryError");
        return;
    }

    res.successResponse();
});

module.exports = router;
