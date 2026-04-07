module.exports = {
    apps: [
        {
            name: "abkciraya-web",
            script: "node_modules/.bin/next",
            args: "start",
            cwd: "./",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "512M",
            env: {
                NODE_ENV: "production",
                PORT: process.env.PORT || 3011,
            },
        },
    ],
};
