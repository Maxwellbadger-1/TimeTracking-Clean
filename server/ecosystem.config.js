/**
 * PM2 Ecosystem Configuration
 * Production Process Manager für TimeTracking Server
 *
 * Verwendung:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      // App Name
      name: 'timetracking-server',

      // Entry Point
      script: './dist/server.js',

      // Working Directory
      cwd: './',

      // Environment Variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Instances (Cluster Mode)
      // 'max' = nutzt alle CPU-Kerne
      // Für Start: 1 Instance empfohlen
      instances: 1,
      exec_mode: 'fork', // 'cluster' für multiple instances

      // Auto Restart
      autorestart: true,
      watch: false, // Kein Watch in Production!
      max_memory_restart: '500M', // Restart bei >500MB RAM

      // Logging
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // Restart Strategy
      min_uptime: '10s', // Mindestlaufzeit vor Neustart
      max_restarts: 10, // Max 10 Restarts in listen_timeout
      listen_timeout: 10000, // 10 Sekunden
      kill_timeout: 5000, // 5 Sekunden für graceful shutdown

      // Cron Restart (optional)
      // cron_restart: '0 3 * * *', // Täglich um 3 Uhr neu starten

      // Advanced Features
      exp_backoff_restart_delay: 100, // Exponential Backoff bei Crashes
    },
  ],

  // Deployment Configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:username/timetracking.git',
      path: '/var/www/timetracking',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
