Maximilians-MacBook-Pro:server maximilianfegg$ npm run dev

> server@0.1.2 dev
> tsx watch --ignore node_modules src/server.ts

{"level":30,"time":1771015827828,"env":"development","path":"/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/database/development.db","environment":"development","msg":"📁 Database path"}
💾 Backup Service initialized
📁 Database path: /Users/maximilianfegg/Desktop/TimeTracking-Clean/server/database/development.db
📁 Backup directory: /Users/maximilianfegg/Desktop/TimeTracking-Clean/backups
{"level":30,"time":1771015827854,"env":"development","msg":"✅ Foreign keys ENABLED and VERIFIED"}
{"level":30,"time":1771015827900,"env":"development","msg":"✅ WAL mode ENABLED and VERIFIED"}
{"level":30,"time":1771015827900,"env":"development","msg":"📊 Initializing database schema..."}
{"level":30,"time":1771015827901,"env":"development","msg":"✅ Database schema initialized successfully"}
{"level":30,"time":1771015827901,"env":"development","msg":"✅ WAL mode enabled for multi-user support"}
{"level":30,"time":1771015827901,"env":"development","msg":"✅ Foreign keys enabled"}
{"level":30,"time":1771015827901,"env":"development","msg":"✅ All 14 tables created"}
{"level":30,"time":1771015827901,"env":"development","msg":"✅ Indexes created for performance"}
{"level":30,"time":1771015827901,"env":"development","msg":"📊 Creating database indexes for performance..."}
{"level":30,"time":1771015827902,"env":"development","msg":"✅ Database indexes created successfully"}
{"level":30,"time":1771015827902,"env":"development","msg":"✅ Performance-optimized composite indexes added"}
{"level":30,"time":1771015827902,"env":"development","count":52,"msg":"📊 Database Indexes Verified"}
{"level":30,"time":1771015827902,"env":"development","table":"absence_requests","indexes":["idx_absence_requests_status","idx_absence_requests_userId","idx_absences_created","idx_absences_dates","idx_absences_status","idx_absences_type","idx_absences_user","idx_absences_user_date","idx_absences_user_status"],"msg":"  📋 absence_requests: 9 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"audit_log","indexes":["idx_audit_action","idx_audit_created","idx_audit_entity","idx_audit_log_entity","idx_audit_log_userId","idx_audit_user","idx_audit_user_created"],"msg":"  📋 audit_log: 7 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"holidays","indexes":["idx_holidays_date"],"msg":"  📋 holidays: 1 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"notifications","indexes":["idx_notifications_created","idx_notifications_read","idx_notifications_user","idx_notifications_userId","idx_notifications_user_date","idx_notifications_user_read"],"msg":"  📋 notifications: 6 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"overtime_balance","indexes":["idx_overtime_month","idx_overtime_user","idx_overtime_user_month"],"msg":"  📋 overtime_balance: 3 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"overtime_corrections","indexes":["idx_overtime_corrections_date","idx_overtime_corrections_userId"],"msg":"  📋 overtime_corrections: 2 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"overtime_daily","indexes":["idx_overtime_daily_date","idx_overtime_daily_user","idx_overtime_daily_user_date"],"msg":"  📋 overtime_daily: 3 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"overtime_transactions","indexes":["idx_overtime_transactions_date","idx_overtime_transactions_type","idx_overtime_transactions_userId"],"msg":"  📋 overtime_transactions: 3 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"overtime_weekly","indexes":["idx_overtime_weekly_user","idx_overtime_weekly_user_week","idx_overtime_weekly_week"],"msg":"  📋 overtime_weekly: 3 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"password_change_log","indexes":["idx_password_change_log_changedBy","idx_password_change_log_userId"],"msg":"  📋 password_change_log: 2 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"time_entries","indexes":["idx_time_entries_date","idx_time_entries_user","idx_time_entries_userId","idx_time_entries_user_date","idx_time_entries_user_start"],"msg":"  📋 time_entries: 5 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"users","indexes":["idx_users_email","idx_users_role_deleted","idx_users_status","idx_users_username"],"msg":"  📋 users: 4 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"vacation_balance","indexes":["idx_vacation_user","idx_vacation_user_year","idx_vacation_year"],"msg":"  📋 vacation_balance: 3 indexes"}
{"level":30,"time":1771015827902,"env":"development","table":"work_time_accounts","indexes":["idx_work_time_accounts_userId"],"msg":"  📋 work_time_accounts: 1 indexes"}
{"level":30,"time":1771015828057,"env":"development","msg":"UnifiedOvertimeService initialized - Single Source of Truth"}
{"level":30,"time":1771015828135,"env":"development","msg":"🌱 Seeding database..."}
{"level":30,"time":1771015828136,"env":"development","msg":"✅ Admin user already exists, skipping seed"}
{"level":30,"time":1771015828136,"env":"development","msg":"🔄 Starting migration system..."}
{"level":30,"time":1771015828136,"env":"development","msg":"✅ Migrations table already exists"}
{"level":30,"time":1771015828137,"env":"development","msg":"📁 Found 6 migration files"}
{"level":40,"time":1771015828190,"env":"development","msg":"⚠️  Invalid migration file: 004_drop_overtime_unique_index.ts (missing default export with up function)"}
{"level":40,"time":1771015828194,"env":"development","msg":"⚠️  Invalid migration file: 005_add_balance_tracking_columns.ts (missing default export with up function)"}
{"level":30,"time":1771015828203,"env":"development","msg":"📊 Found 3 executed migrations"}
{"level":30,"time":1771015828203,"env":"development","msg":"🚀 Running 1 pending migrations..."}
{"level":30,"time":1771015828203,"env":"development","msg":"⏳ Running migration: 006_add_time_entry_transaction_type"}
{"level":30,"time":1771015828207,"env":"development","msg":"🚀 Migration 006: Adding time_entry and modern transaction types..."}
{"level":30,"time":1771015828207,"env":"development","msg":"📊 Current transactions: 7"}
{"level":30,"time":1771015828207,"env":"development","msg":"📝 Creating new table with extended types..."}
{"level":30,"time":1771015828208,"env":"development","msg":"📦 Copying existing transactions..."}
{"level":30,"time":1771015828212,"env":"development","msg":"✅ Copied 7 transactions successfully"}
{"level":30,"time":1771015828212,"env":"development","msg":"🗑️  Dropping old table..."}
{"level":30,"time":1771015828213,"env":"development","msg":"📝 Renaming new table..."}
{"level":30,"time":1771015828225,"env":"development","msg":"🔍 Recreating indexes..."}
{"level":30,"time":1771015828226,"env":"development","msg":""}
{"level":30,"time":1771015828226,"env":"development","msg":"================================================================================"}
{"level":30,"time":1771015828226,"env":"development","msg":"✅ MIGRATION 006 COMPLETED"}
{"level":30,"time":1771015828226,"env":"development","msg":"================================================================================"}
{"level":30,"time":1771015828226,"env":"development","msg":"Total transactions migrated: 7"}
{"level":30,"time":1771015828226,"env":"development","msg":""}
{"level":30,"time":1771015828226,"env":"development","msg":"NEW allowed transaction types:"}
{"level":30,"time":1771015828226,"env":"development","msg":"  Modern types (preferred):"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - time_entry (daily overtime from time entries)"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - worked (worked hours transaction)"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - vacation_credit, sick_credit, overtime_comp_credit, special_credit"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - unpaid_deduction (unpaid leave)"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - holiday_credit, weekend_credit"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - correction, payout, carry_over"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - initial_balance, year_end_balance"}
{"level":30,"time":1771015828226,"env":"development","msg":""}
{"level":30,"time":1771015828226,"env":"development","msg":"  Legacy types (kept for compatibility):"}
{"level":30,"time":1771015828226,"env":"development","msg":"    - earned, compensation, carryover, unpaid_adjustment"}
{"level":30,"time":1771015828226,"env":"development","msg":"================================================================================"}
{"level":30,"time":1771015828226,"env":"development","msg":""}
{"level":30,"time":1771015828228,"env":"development","msg":"✅ Migration completed: 006_add_time_entry_transaction_type"}
{"level":30,"time":1771015828228,"env":"development","msg":"✅ All migrations completed successfully"}
{"level":30,"time":1771015828229,"env":"development","msg":"🎄 Initializing holidays..."}
{"level":30,"time":1771015828229,"env":"development","earliestHireYear":2025,"currentYear":2026,"endYear":2029,"totalYears":5,"msg":"📅 Loading holidays for range"}
{"level":30,"time":1771015828229,"env":"development","year":2025,"msg":"📅 Loading holidays for year"}
{"level":30,"time":1771015828229,"env":"development","year":2025,"url":"https://www.spiketime.de/feiertagapi/feiertage/BY/2025","msg":"🔄 Fetching holidays from API"}
{"level":30,"time":1771015828596,"env":"development","year":2025,"count":14,"msg":"✅ Fetched holidays from API"}
{"level":30,"time":1771015828603,"env":"development","year":2025,"count":14,"msg":"✅ Successfully loaded holidays"}
{"level":30,"time":1771015828603,"env":"development","year":2026,"msg":"📅 Loading holidays for year"}
{"level":30,"time":1771015828603,"env":"development","year":2026,"url":"https://www.spiketime.de/feiertagapi/feiertage/BY/2026","msg":"🔄 Fetching holidays from API"}
{"level":30,"time":1771015828837,"env":"development","year":2026,"count":14,"msg":"✅ Fetched holidays from API"}
{"level":30,"time":1771015828840,"env":"development","year":2026,"count":14,"msg":"✅ Successfully loaded holidays"}
{"level":30,"time":1771015828840,"env":"development","year":2027,"msg":"📅 Loading holidays for year"}
{"level":30,"time":1771015828840,"env":"development","year":2027,"url":"https://www.spiketime.de/feiertagapi/feiertage/BY/2027","msg":"🔄 Fetching holidays from API"}
{"level":30,"time":1771015828987,"env":"development","year":2027,"count":14,"msg":"✅ Fetched holidays from API"}
{"level":30,"time":1771015828990,"env":"development","year":2027,"count":14,"msg":"✅ Successfully loaded holidays"}
{"level":30,"time":1771015828990,"env":"development","year":2028,"msg":"📅 Loading holidays for year"}
{"level":30,"time":1771015828990,"env":"development","year":2028,"url":"https://www.spiketime.de/feiertagapi/feiertage/BY/2028","msg":"🔄 Fetching holidays from API"}
{"level":30,"time":1771015829056,"env":"development","year":2028,"count":14,"msg":"✅ Fetched holidays from API"}
{"level":30,"time":1771015829060,"env":"development","year":2028,"count":14,"msg":"✅ Successfully loaded holidays"}
{"level":30,"time":1771015829060,"env":"development","year":2029,"msg":"📅 Loading holidays for year"}
{"level":30,"time":1771015829060,"env":"development","year":2029,"url":"https://www.spiketime.de/feiertagapi/feiertage/BY/2029","msg":"🔄 Fetching holidays from API"}
{"level":30,"time":1771015829187,"env":"development","year":2029,"count":14,"msg":"✅ Fetched holidays from API"}
{"level":30,"time":1771015829190,"env":"development","year":2029,"count":14,"msg":"✅ Successfully loaded holidays"}
{"level":30,"time":1771015829190,"env":"development","yearsLoaded":"2025-2029","totalYears":5,"msg":"🎉 Holidays initialized successfully"}
{"level":30,"time":1771015829206,"env":"development","msg":"✅ Backup scheduler started (daily at 2:00 AM)"}
{"level":30,"time":1771015829212,"env":"development","msg":"✅ Year-end rollover scheduler started (January 1st at 00:05 AM Europe/Berlin)"}
{"level":30,"time":1771015829218,"env":"development","msg":"📅 Holiday auto-update scheduled (daily at 03:00 AM Europe/Berlin)"}
{"level":30,"time":1771015829219,"env":"development","msg":"✅ WebSocket server initialized on /ws"}
{"level":30,"time":1771015829219,"env":"development","msg":"🔌 WebSocket endpoint: ws://0.0.0.0:3000/ws"}
node:events:486
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
    at Server.setupListenHandle [as _listen2] (node:net:1940:16)
    at listenInCluster (node:net:1997:12)
    at node:net:2206:7
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
Emitted 'error' event on WebSocketServer instance at:
    at Server.emit (node:events:508:28)
    at emitErrorNT (node:net:1976:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -48,
  syscall: 'listen',
  address: '0.0.0.0',
  port: 3000
}

Node.js v24.11.0