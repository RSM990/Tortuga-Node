module.exports = {
  apps: [
    {
      name: 'tortuga-app',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
