module.exports = {
  apps: [{
    name: 'healthy-home-exchange-api',
    script: 'server.js',
    cwd: '/Users/sara2/healthy-home-exchange-api',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
      // Set MONGO_URI, EMAIL_USER, EMAIL_PASS via pm2 env or shell export
      // Do NOT commit secrets here
    }
  }]
};
