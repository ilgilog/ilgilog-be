/**
 *  ilgilog
 */

"use strict";

module.exports.router = function (mysql, util, moment, { matchedData, validationResult, body, query, validationHandler }, schema) {
    this.PREFIX = "";

    this.GET("name", async (req, res) => {
        let result = await mysql
            .query("SELECT * FROM some_table")
            .then((result) => {
                // 쿼리 성공. result 객체 분석 및 처리
                if (result.rows && result.rows.length > 0) {
                    // 쿼리 결과가 존재하는 경우
                    console.log(result.rows);
                } else {
                    // 쿼리 결과가 비어 있는 경우
                    console.log("No data found.");
                }
            })
            .catch((error) => {
                // 쿼리 실패. 에러 처리
                console.error("Query error:", error);
            });
        if (!result.success) {
            console.log(7777);
            res.failResponse("Server Error");
            return;
        }

        console.log(result.rows[0]);
        res.successResponse(result.rows[0]);
    });

    this.POST("insert/name", async (req, res) => {
        let data = {
            name: "Jotuna",
        };

        let result = await mysql.query(`INSERT INTO ${schema.DB_SCHEMA} name VALUES ?;`, [data.name]);

        if (!result.success) {
            res.failResponse("Server Error");
            return;
        }

        res.successResponse();
    });
};
