/**
 * ilgilog
 */

"use strict";

const mysql = {};

const engine = require("mysql2/promise");
const { util, log, config } = require("../util");

mysql._poolCluster = null;
mysql._runningBeat = false;

mysql.TRANSACTION = {
    ROLLBACK: 0,
    COMMIT: 1,
};

mysql.CONNECTION_TYPE = {
    READER: 0,
    WRITER: 1,
};

/**
 * mysql 엔진 초기화
 * @returns
 */
mysql.init = async function () {
    // 연결 객체 초기화 (https://www.npmjs.com/package/mysql2)

    this._pool = engine.createPool({
        waitForConnections: true,
        maxIdle: config.database.connection.config.connectionLimit,
        multipleStatements: true,
        dateStrings: true,

        ...config.database.connection.config,
    });

    try {
        await this.testConnection();
    } catch (exception) {
        log.error(`MySQL - Connection test failed: ${exception.stack}`);
        throw exception;
    }
};

mysql.testConnection = function () {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await this.query(`SELECT 1;`, [], { silent: true });
            if (result.success) {
                this.createBeatInterval();
                log.info(`MySQL - Connection check: OK!`);
                resolve();
            }
        } catch (exception) {
            log.info(`MySQL - Connection test failed: ${exception}`);
            reject(exception);
        }
    });
};

mysql.createBeatInterval = async function () {
    let res = await this.query(`SHOW SESSION VARIABLES LIKE 'wait_timeout'`, null, { silent: true });
    if (!res.success || res.rows.length === 0) {
        log.warn(`MySQL - WARN: Heartbear check failed (reason: FAIL: DB)`);
        return;
    }

    if (res.rows[0]?.Variable_name !== "wait_timeout") {
        log.warn(`MySQL - WARN: Heartbeat check failed (reason: FAIL:VARIABLE_NOT_EXISTS)`);
        return;
    }

    let value = Number(res.rows[0].Value);

    if (!Number.isInteger(value)) {
        log.warn(`MySQL - WARN: Heartbeat check failed (reason: FAIL:VALUE_INVALID)`);
        return;
    }

    let interval = Math.max(Math.floor(value / 2), 10) * 1000;
    setInterval(() => this._runBeatPacket(), interval);
};

mysql._runBeatPacket = async function () {
    if (this._runningBeat) return;
    this._runningBeat = true;

    await this.query(`SELECT 1;`, null, { silent: true });

    this._runningBeat = false;
};

mysql._getConnection = async function (connectionType) {
    try {
        return await this._pool.getConnection();
    } catch (exception) {
        log.error(`MySQL - Connection error (exception: ${exception.stack ?? exception})`);

        return null;
    }
};

mysql.transactionStatement = function (process) {
    return new Promise(async (resolve, _) => {
        let connection;
        let rollbackDisabled;

        try {
            connection = await this._getConnection(mysql.CONNECTION_TYPE.WRITER);

            if (!connection) {
                return {
                    success: false,
                };
            }

            let processMethods = {
                query: async (query, params = [], options = {}) => {
                    return await this.query(query, params, {
                        ...options,
                        connection: connection,
                        manualRelease: true,
                    });
                },

                execute: async (query, params = [], options = {}) => {
                    return await this.execute(query, params, {
                        ...options,
                        connection: connection,
                        manualRelease: true,
                    });
                },
            };

            await connection.beginTransaction();

            let result = await process(processMethods);

            if (result === this.TRANSACTION.COMMIT) {
                await connection.commit();
            } else if (result === this.TRANSACTION.ROLLBACK) {
                await connection.rollback();
                rollbackDisabled = true;
            }

            resolve({
                success: true,
                commit: result === this.TRANSACTION.COMMIT,
            });
        } catch (exception) {
            log.error(`MySQL - Transaction statement error (exception: ${exception.stack ?? exception})`);

            if (connection && !rollbackDisabled) {
                try {
                    await connection.rollback();
                } catch (exception) {
                    log.error(`MySQL - Transaction rollback error (exception: ${exception.stack ?? exception})`);
                }
            }
        } finally {
            if (connection) {
                try {
                    connection.release();
                } catch (exception) {
                    log.error(`MySQL - Connection release error (exception: ${exception.stack ?? exception})`);
                }
            }
        }
    });
};

/**
 * mysql begin transaction
 * @param {Connection} connection connection
 * @returns {boolean} success
 */
mysql.beginTransaction = async function (connection) {
    try {
        await connection.beginTransaction();

        return true;
    } catch (exception) {
        log.error(`MySQL - Transaction error (exception: ${exception.stack ?? exception})`);

        return false;
    }
};

/**
 * mysql commit
 * @param {Connection} connection connection
 * @returns {boolean} success
 */
mysql.commit = async function (connection) {
    try {
        await connection.commit();

        return true;
    } catch (exception) {
        log.error(`MySQL - Commit error (exception: ${exception.stack ?? exception})`);

        return false;
    }
};

/**
 * mysql rollback
 * @param {Connection} connection connection
 * @returns {boolean} success
 */
mysql.rollback = async function (connection) {
    try {
        await connection.rollback();

        return true;
    } catch (exception) {
        log.error(`MySQL - Rollback error (exception: ${exception.stack ?? exception})`);

        return false;
    }
};

/**
 * mysql release
 * @param {Connection} connection connection
 * @returns {boolean} success
 */
mysql.release = async function (connection) {
    try {
        if (connection) {
            connection.release();
        }

        return true;
    } catch (exception) {
        log.error(`MySQL - Release error (exception: ${exception.stack ?? exception})`);

        return false;
    }
};

mysql.query = async function (query, params = [], options = {}) {
    let connection;

    if (!options.connection) {
        connection = await this._getConnection();

        if (!connection) {
            return {
                success: false,
            };
        }
    } else {
        connection = options.connection;
    }

    // let clusterId = connection?.connection?._clusterId ?? "unknown";

    try {
        let [rows, fields] = await connection.query(query, params);

        if (!options.silent) log.info(`MySQL - : [${query}] > Success`);

        return {
            success: true,
            rows: rows,
        };
    } catch (exception) {
        log.error(`MySQL - : Query error: [${query}] (exception: ${exception.stack ?? exception})`);

        return {
            success: false,
        };
    } finally {
        if (!options.manualRelease) {
            try {
                connection.release();
            } catch (exception) {
                log.critical(`MySQL - : Release error (exception: ${exception.stack ?? exception})`);
            }
        }
    }
};

/**
 * mysql execute 실행
 * @param {string} query SQL 쿼리문
 * @param {Array} params 데이터 배열
 * @param {object} options 연결 객체 지정, 성공 로그 비활성화, 수동 릴리즈 옵션
 * @returns {object} 성공 여부, 데이터 값
 */
mysql.execute = async function (query, params = [], options = {}) {
    let connection;

    if (!options.connection) {
        connection = await this._getConnection();

        if (!connection) {
            return {
                success: false,
            };
        }
    } else {
        connection = options.connection;
    }

    // let clusterId = connection?.connection?._clusterId ?? "unknown";

    try {
        let [rows, fields] = await connection.execute(query, params);

        if (!options.silent) log.info(`MySQL - : [${query}] > Success`);

        return {
            success: true,
            rows: rows,
        };
    } catch (exception) {
        log.error(`MySQL - : Execute error: [${query}] (exception: ${exception.stack ?? exception})`);

        return {
            success: false,
        };
    } finally {
        if (!options.manualRelease) {
            try {
                connection.release();
            } catch (exception) {
                log.critical(`MySQL - : Release error (exception: ${exception.stack ?? exception})`);
            }
        }
    }
};

module.exports = mysql;
