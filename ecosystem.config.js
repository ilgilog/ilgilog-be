module.exports = {
    apps: [
        {
            name: "ilgilog",
            script: ".src/main.js",
            exec_mode: "fork",
            output: "./maintenance/pm2/run.log",
            error: "./maintenance/pm2/error.log",

            watch: false,
            source_map_support: false,
            autorestart: true,
            instances: 1,
            wait_ready: true,
            listen_timeout: 30000,
            kill_timeout: 10000,

            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            },
        },
    ],
};
