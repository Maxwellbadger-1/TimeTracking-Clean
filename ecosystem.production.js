/**
 * PM2 Ecosystem Configuration - Production (Blue Server)
 *
 * 2-Tier DB Architecture: Uses /home/ubuntu/databases/production.db directly.
 * DATABASE_PATH is set explicitly so the server never falls back to path resolution.
 *
 * Usage (on server):
 *   pm2 start /home/ubuntu/TimeTracking-Clean/ecosystem.production.js
 *   pm2 save
 *
 * Rollback:
 *   pm2 stop timetracking-server && pm2 delete timetracking-server
 *   cd /home/ubuntu/TimeTracking-Clean/server
 *   rm database.db && cp database.db.backup.TIMESTAMP database.db
 *   TZ=Europe/Berlin NODE_ENV=production SESSION_SECRET=$SESSION_SECRET \
 *     ALLOWED_ORIGINS=$ALLOWED_ORIGINS \
 *     pm2 start dist/server.js --name timetracking-server --cwd /home/ubuntu/TimeTracking-Clean/server --time
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'timetracking-server',
      script: './dist/server.js',
      cwd: '/home/ubuntu/TimeTracking-Clean/server',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'Europe/Berlin',
        DATABASE_PATH: '/home/ubuntu/databases/production.db',
        // SESSION_SECRET and ALLOWED_ORIGINS are read from the server's .env file
        // at startup. Set them here only if .env is not available.
        // SESSION_SECRET: '',  // DO NOT commit — load from .env or set manually
        // ALLOWED_ORIGINS: 'tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420',
      },

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      error_file: '/home/ubuntu/TimeTracking-Clean/server/logs/error.log',
      out_file: '/home/ubuntu/TimeTracking-Clean/server/logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      time: true,

      min_uptime: '10s',
      max_restarts: 10,
      listen_timeout: 10000,
      kill_timeout: 5000,
      exp_backoff_restart_delay: 100,
    },
  ],
};
