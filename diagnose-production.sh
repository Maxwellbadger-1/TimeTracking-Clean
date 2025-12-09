#!/bin/bash
# Production Environment Diagnostic Script
# Checks overtime calculations, holidays, absences, and environment

echo "============================================"
echo "🔍 PRODUCTION ENVIRONMENT DIAGNOSTIC"
echo "============================================"
echo ""

# 1. Check Server Environment
echo "📊 1. SERVER ENVIRONMENT"
echo "----------------------------------------"
echo "Current Date/Time: $(date)"
echo "Timezone: $(date +%Z)"
echo "NODE_ENV: ${NODE_ENV:-NOT SET}"
echo ""

# 2. Check Database
echo "📊 2. DATABASE CHECK"
echo "----------------------------------------"
cd /home/ubuntu/TimeTracking-Clean/server

if [ ! -f "database.db" ]; then
  echo "❌ database.db NOT FOUND!"
  exit 1
fi

echo "✅ database.db exists"
echo "Size: $(du -h database.db | cut -f1)"
echo ""

# 3. Run SQL Diagnostics
echo "📊 3. SQL DIAGNOSTICS"
echo "----------------------------------------"
sqlite3 database.db <<'EOF'
.mode column
.headers on

-- Users
SELECT '=== USERS ===' as '';
SELECT
  id,
  username,
  weeklyHours,
  hireDate,
  status
FROM users
WHERE deletedAt IS NULL
ORDER BY id;

-- Time Entries Count
SELECT '' as '';
SELECT '=== TIME ENTRIES COUNT ===' as '';
SELECT
  u.id as userId,
  u.username,
  COUNT(te.id) as totalEntries,
  COALESCE(SUM(te.hours), 0) as totalHours
FROM users u
LEFT JOIN time_entries te ON u.id = te.userId
WHERE u.deletedAt IS NULL
GROUP BY u.id
ORDER BY u.id;

-- Holidays
SELECT '' as '';
SELECT '=== HOLIDAYS (2025) ===' as '';
SELECT COUNT(*) as holiday_count FROM holidays WHERE date LIKE '2025%';
SELECT date, name FROM holidays WHERE date LIKE '2025%' ORDER BY date LIMIT 10;

-- Absence Requests
SELECT '' as '';
SELECT '=== ABSENCE REQUESTS ===' as '';
SELECT
  u.username,
  ar.type,
  ar.startDate,
  ar.endDate,
  ar.days,
  ar.status
FROM absence_requests ar
JOIN users u ON ar.userId = u.id
WHERE u.deletedAt IS NULL
ORDER BY ar.startDate DESC
LIMIT 10;

-- Overtime Balance (December 2025)
SELECT '' as '';
SELECT '=== OVERTIME BALANCE (2025-12) ===' as '';
SELECT
  u.id as userId,
  u.username,
  ob.month,
  ob.targetHours,
  ob.actualHours,
  ob.overtime
FROM users u
LEFT JOIN overtime_balance ob ON u.id = ob.userId AND ob.month = '2025-12'
WHERE u.deletedAt IS NULL
ORDER BY u.id;

-- Daily Overtime (Last 7 days)
SELECT '' as '';
SELECT '=== DAILY OVERTIME (Last 7 Days) ===' as '';
SELECT
  u.username,
  od.date,
  od.targetHours,
  od.actualHours,
  od.overtime
FROM overtime_daily od
JOIN users u ON od.userId = u.id
WHERE u.deletedAt IS NULL
  AND od.date >= date('now', '-7 days')
ORDER BY od.date DESC, u.username
LIMIT 20;

-- Check for overtime_corrections table
SELECT '' as '';
SELECT '=== OVERTIME CORRECTIONS CHECK ===' as '';
SELECT COUNT(*) as correction_count FROM overtime_corrections;

-- Work Time Accounts
SELECT '' as '';
SELECT '=== WORK TIME ACCOUNTS ===' as '';
SELECT
  u.username,
  wta.currentBalance,
  wta.lastUpdated
FROM work_time_accounts wta
JOIN users u ON wta.userId = u.id
WHERE u.deletedAt IS NULL
ORDER BY u.id;

EOF

echo ""
echo "============================================"
echo "✅ DIAGNOSTIC COMPLETE"
echo "============================================"
echo ""
echo "📋 Next Steps:"
echo "1. Copy the entire output above"
echo "2. Send it to Claude for analysis"
echo "3. Claude will identify the exact problem"
