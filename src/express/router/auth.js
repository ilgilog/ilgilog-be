/**
 * ilgilog
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { matchedData, validationResult, body, query } = require("express-validator");
const util = require("../../util/util");
const config = require("../../util/config");
const axios = require("axios");

const schema = config.database.schema.COMMON;

router.get("/kakao", async (req, res) => {
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
            res.failResponse("ServerError");
            return;
        }

        let data = {};

        if (checkUser.rows.length === 0) {
            let joinQuery = `INSERT INTO ${schema}.user (email, nickname) VALUES (?, ?);`;
            let joinQueryParams = [userInfo.email, userInfo.nickName];

            let joinUser = await mysql.execute(joinQuery, joinQueryParams);

            if (!joinUser.success) {
                res.failResponse("ServerError");
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
                res.failResponse("ServerError");
                return;
            }

            data = {
                uid: joinUser.insertId,
                email: userInfo.email,
                nickName: userInfo.nickName,
                firstLogin: 1,
                access_token: token.access_token,
                refresh_token: token.refresh_token,
            };
        } else {
            let user = await mysql.query(
                `
                SELECT user.id, user.email, user.nickname, verification.first_login 
                FROM user LEFT JOIN verification ON user.id = verification.uid 
                WHERE user.email = ?;`,
                [userInfo.email],
            );

            if (!user.success) {
                res.failResponse("ServerError");
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
                access_token: token.access_token,
                refresh_token: token.refresh_token,
            };
        }
    } catch (exception) {
        res.failResponse("ServerError");
        return;
    }

    res.successResponse(data);
});

module.exports = router;
