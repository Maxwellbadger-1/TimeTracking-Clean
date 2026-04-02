/**
 * PM2 Ecosystem Configuration - Production (Blue Server)
 *
 * 2-Tier DB Architecture: Uses /home/ubuntu/databases/production.db directly.
 * DATABASE_PATH is set explicitly so the server never falls back to path resolution.
 *
 * Usage (on server):
 *   pm2 start /home/ubuntu/TimeTracking-Clean/ecosystem.production.config.js
 *   pm2 save
 *
 * Note: SESSION_SECRET and ALLOWED_ORIGINS must be set in environment before running,
 * or passed via --env when starting. They are NOT committed to this file.
 *
 * Rollback:
 *   pm2 stop timetracking-server && pm2 delete timetracking-server
 *   cd /home/ubuntu/TimeTracking-Clean/server
 *   rm database.db && cp database.db.backup.20260402_125311 database.db
 *   SESSION_SECRET=$(grep '^SESSION_SECRET=' server/.env | cut -d= -f2)
 *   ALLOWED_ORIGINS='tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420'
 *   TZ=Europe/Berlin NODE_ENV=production SESSION_SECRET=$SESSION_SECRET \
 *     ALLOWED_ORIGINS=$ALLOWED_ORIGINS \
 *     pm2 start dist/server.js --name timetracking-server \
 *     --cwd /home/ubuntu/TimeTracking-Clean/server --time --update-env
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
        // SESSION_SECRET and ALLOWED_ORIGINS are passed via shell environment
        // when starting: SESSION_SECRET=... pm2 start ecosystem.production.config.js
        // They are injected via --update-env and persist in PM2 dump.
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
