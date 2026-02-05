/**
 * Validate ALL Test Users - Comprehensive Report
 *
 * Purpose: Run validation for all 10 test users and document ALL discrepancies
 *
 * Usage:
 *   npm run validate:all-test-users
 */

import Database from 'better-sqlite3';
import { getUserById } from '../services/userService.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import fs from 'fs';
import path from 'path';
import { formatDate, getCurrentDate } from '../utils/timezone.js';

const db = new Database('./database/development.db');

interface ValidationResult {
  userId: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'NO_DATA';
  issues: string[];
  details: {
    expectedTarget: number;
    dbTarget: number;
    expectedActual: number;
    dbActual: number;
    expectedOvertime: number;
    dbOvertime: number;
  } | null;
}

// Local formatDate removed - using timezone-safe version from timezone.ts

function validateUser(userId: number, month: string): ValidationResult {
  const user = getUserById(userId);
  if (!user) {
    return {
      userId,
      name: `User ${userId}`,
      status: 'FAIL',
      issues: ['User not found'],
      details: null,
    };
  }

  const name = `${user.firstName} ${user.lastName}`;

  // Parse month
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Cap to today if in current month
  const effectiveEndDate = endDate > today ? today : endDate;

  // Respect hire date
  const effectiveStartDate = startDate < new Date(user.hireDate) ? new Date(user.hireDate) : startDate;

  // Load holidays
  const holidays = db
    .prepare('SELECT date FROM holidays WHERE date BETWEEN ? AND ?')
    .all(formatDate(effectiveStartDate, 'yyyy-MM-dd'), formatDate(effectiveEndDate, 'yyyy-MM-dd')) as Array<{ date: string }>;
  const holidaySet = new Set(holidays.map((h) => h.date));

  // Calculate target hours
  let totalTargetHours = 0;
  for (let d = new Date(effectiveStartDate); d <= effectiveEndDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const dailyTarget = getDailyTargetHours(user, dateStr);
    totalTargetHours += dailyTarget;
  }

  // Get absences
  const absences = db
    .prepare(
      `SELECT id, type, startDate, endDate FROM absence_requests
       WHERE userId = ? AND status = 'approved'
       AND ((startDate <= ? AND endDate >= ?) OR (startDate >= ? AND startDate <= ?))`
    )
    .all(userId, formatDate(effectiveEndDate, 'yyyy-MM-dd'), formatDate(effectiveStartDate, 'yyyy-MM-dd'), formatDate(effectiveStartDate, 'yyyy-MM-dd'), formatDate(effectiveEndDate, 'yyyy-MM-dd')) as Array<{
    id: number;
    type: string;
    startDate: string;
    endDate: string;
  }>;

  let totalAbsenceCredits = 0;
  let totalUnpaidReduction = 0;

  absences.forEach((abs) => {
    const absStart = new Date(Math.max(new Date(abs.startDate).getTime(), effectiveStartDate.getTime()));
    const absEnd = new Date(Math.min(new Date(abs.endDate).getTime(), effectiveEndDate.getTime()));

    let absenceHours = 0;
    for (let d = new Date(absStart); d <= absEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      const dateStr = formatDate(d, 'yyyy-MM-dd');
      if (holidaySet.has(dateStr)) continue;

      const dailyHours = getDailyTargetHours(user, dateStr);
      if (dailyHours > 0) {
        absenceHours += dailyHours;
      }
    }

    if (abs.type === 'unpaid') {
      totalUnpaidReduction += absenceHours;
    } else {
      totalAbsenceCredits += absenceHours;
    }
  });

  // Get time entries
  const timeEntries = db
    .prepare('SELECT hours FROM time_entries WHERE userId = ? AND date BETWEEN ? AND ?')
    .all(userId, formatDate(effectiveStartDate, 'yyyy-MM-dd'), formatDate(effectiveEndDate, 'yyyy-MM-dd')) as Array<{ hours: number }>;

  const totalWorkedHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);

  // Calculate expected values
  const adjustedTargetHours = totalTargetHours - totalUnpaidReduction;
  const actualHours = totalWorkedHours + totalAbsenceCredits;
  const calculatedOvertime = actualHours - adjustedTargetHours;

  // Get DB values
  const dbRecord = db
    .prepare('SELECT targetHours, actualHours, overtime FROM overtime_balance WHERE userId = ? AND month = ?')
    .get(userId, month) as { targetHours: number; actualHours: number; overtime: number } | undefined;

  if (!dbRecord) {
    return {
      userId,
      name,
      status: 'NO_DATA',
      issues: ['No database record for this month'],
      details: {
        expectedTarget: adjustedTargetHours,
        dbTarget: 0,
        expectedActual: actualHours,
        dbActual: 0,
        expectedOvertime: calculatedOvertime,
        dbOvertime: 0,
      },
    };
  }

  // Check for mismatches
  const issues: string[] = [];
  const tolerance = 0.01;

  if (Math.abs(adjustedTargetHours - dbRecord.targetHours) >= tolerance) {
    issues.push(
      `Target Hours Mismatch: Expected ${adjustedTargetHours}h, DB ${dbRecord.targetHours}h (Δ ${(adjustedTargetHours - dbRecord.targetHours).toFixed(2)}h)`
    );
  }

  if (Math.abs(actualHours - dbRecord.actualHours) >= tolerance) {
    issues.push(
      `Actual Hours Mismatch: Expected ${actualHours}h, DB ${dbRecord.actualHours}h (Δ ${(actualHours - dbRecord.actualHours).toFixed(2)}h)`
    );
  }

  if (Math.abs(calculatedOvertime - dbRecord.overtime) >= tolerance) {
    issues.push(
      `Overtime Mismatch: Expected ${calculatedOvertime >= 0 ? '+' : ''}${calculatedOvertime}h, DB ${dbRecord.overtime >= 0 ? '+' : ''}${dbRecord.overtime}h (Δ ${(calculatedOvertime - dbRecord.overtime).toFixed(2)}h)`
    );
  }

  return {
    userId,
    name,
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    issues,
    details: {
      expectedTarget: adjustedTargetHours,
      dbTarget: dbRecord.targetHours,
      expectedActual: actualHours,
      dbActual: dbRecord.actualHours,
      expectedOvertime: calculatedOvertime,
      dbOvertime: dbRecord.overtime,
    },
  };
}

// Main execution
console.log('🔍 VALIDATING ALL TEST USERS');
console.log('═'.repeat(80));
console.log('Month: 2026-01\n');

// Get all test users by username pattern
const testUsers = db.prepare(`
  SELECT id FROM users
  WHERE username LIKE 'test.%'
  ORDER BY id
`).all() as Array<{ id: number }>;

const testUserIds = testUsers.map(u => u.id);
console.log(`Found ${testUserIds.length} test users: ${testUserIds.join(', ')}\n`);

const results: ValidationResult[] = [];

for (const userId of testUserIds) {
  const result = validateUser(userId, '2026-01');
  results.push(result);

  const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'NO_DATA' ? '⚠️' : '❌';
  console.log(`${statusIcon} User ${userId}: ${result.name} - ${result.status}`);
  if (result.issues.length > 0) {
    result.issues.forEach((issue) => console.log(`   ${issue}`));
  }
}

// Summary
console.log('\n' + '═'.repeat(80));
console.log('📊 VALIDATION SUMMARY');
console.log('═'.repeat(80));

const passCount = results.filter((r) => r.status === 'PASS').length;
const failCount = results.filter((r) => r.status === 'FAIL').length;
const noDataCount = results.filter((r) => r.status === 'NO_DATA').length;

console.log(`\n✅ PASS: ${passCount}/${results.length}`);
console.log(`❌ FAIL: ${failCount}/${results.length}`);
console.log(`⚠️  NO DATA: ${noDataCount}/${results.length}\n`);

if (failCount > 0) {
  console.log('❌ FAILED USERS:');
  console.log('─'.repeat(80));
  results
    .filter((r) => r.status === 'FAIL')
    .forEach((r) => {
      console.log(`\nUser ${r.userId}: ${r.name}`);
      r.issues.forEach((issue) => console.log(`  • ${issue}`));
    });
}

// Write report
const reportPath = path.join(process.cwd(), 'VALIDATION_ALL_USERS_REPORT.md');
let report = `# Validation Report: All Test Users\n\n`;
report += `**Date:** ${formatDate(getCurrentDate(), 'yyyy-MM-dd')}\n`;
report += `**Month:** 2026-01\n\n`;
report += `## Summary\n\n`;
report += `- ✅ PASS: ${passCount}/${results.length}\n`;
report += `- ❌ FAIL: ${failCount}/${results.length}\n`;
report += `- ⚠️  NO DATA: ${noDataCount}/${results.length}\n\n`;

if (failCount > 0 || noDataCount > 0) {
  report += `## Issues Found\n\n`;
  results
    .filter((r) => r.status !== 'PASS')
    .forEach((r) => {
      report += `### User ${r.userId}: ${r.name}\n\n`;
      report += `**Status:** ${r.status === 'FAIL' ? '❌ FAIL' : '⚠️  NO DATA'}\n\n`;
      report += `**Issues:**\n`;
      r.issues.forEach((issue) => {
        report += `- ${issue}\n`;
      });
      if (r.details) {
        report += `\n**Details:**\n`;
        report += `- Expected Target: ${r.details.expectedTarget}h\n`;
        report += `- DB Target: ${r.details.dbTarget}h\n`;
        report += `- Expected Actual: ${r.details.expectedActual}h\n`;
        report += `- DB Actual: ${r.details.dbActual}h\n`;
        report += `- Expected Overtime: ${r.details.expectedOvertime >= 0 ? '+' : ''}${r.details.expectedOvertime}h\n`;
        report += `- DB Overtime: ${r.details.dbOvertime >= 0 ? '+' : ''}${r.details.dbOvertime}h\n`;
      }
      report += `\n---\n\n`;
    });
}

report += `## All Results\n\n`;
results.forEach((r) => {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'NO_DATA' ? '⚠️' : '❌';
  report += `### ${icon} User ${r.userId}: ${r.name}\n\n`;
  report += `**Status:** ${r.status}\n\n`;
  if (r.details) {
    report += `| Metric | Expected | Database | Match |\n`;
    report += `|--------|----------|----------|-------|\n`;
    report += `| Target Hours | ${r.details.expectedTarget}h | ${r.details.dbTarget}h | ${Math.abs(r.details.expectedTarget - r.details.dbTarget) < 0.01 ? '✅' : '❌'} |\n`;
    report += `| Actual Hours | ${r.details.expectedActual}h | ${r.details.dbActual}h | ${Math.abs(r.details.expectedActual - r.details.dbActual) < 0.01 ? '✅' : '❌'} |\n`;
    report += `| Overtime | ${r.details.expectedOvertime >= 0 ? '+' : ''}${r.details.expectedOvertime}h | ${r.details.dbOvertime >= 0 ? '+' : ''}${r.details.dbOvertime}h | ${Math.abs(r.details.expectedOvertime - r.details.dbOvertime) < 0.01 ? '✅' : '❌'} |\n`;
    report += `\n`;
  }
});

fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`\n📄 Detailed report: ${reportPath}`);
console.log('═'.repeat(80) + '\n');

db.close();
process.exit(failCount > 0 ? 1 : 0);
