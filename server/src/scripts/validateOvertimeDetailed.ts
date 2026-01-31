/**
 * Detailed Overtime Validation Script
 *
 * Purpose: Debug overtime calculations with day-by-day breakdown
 *
 * Usage:
 *   npm run validate:overtime:detailed -- --userId=3
 *   npm run validate:overtime:detailed -- --userId=3 --month=2026-01
 *   npm run validate:overtime:detailed -- --all
 *
 * Features:
 * - Day-by-day target hours breakdown
 * - workSchedule visualization
 * - Holiday highlighting
 * - Absence credit calculation
 * - Database comparison (expected vs. actual)
 * - Discrepancy highlighting
 */

import Database from 'better-sqlite3';
import { getUserById } from '../services/userService.js';
import { getDailyTargetHours, calculateAbsenceHoursWithWorkSchedule } from '../utils/workingDays.js';
import { getCurrentDate } from '../utils/timezone.js';
import fetch from 'node-fetch';

const db = new Database('./database/development.db');

// API Base URL for frontend validation
const API_BASE = 'http://localhost:3000/api';

// Global session cookie for API authentication
let sessionCookie: string | null = null;

interface ValidationOptions {
  userId?: number;
  month?: string;
  all?: boolean;
}

function parseArgs(): ValidationOptions {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle both --userId=3 and --userId 3 formats
    if (arg.startsWith('--userId=')) {
      options.userId = parseInt(arg.split('=')[1]);
    } else if (arg === '--userId' && args[i + 1]) {
      options.userId = parseInt(args[i + 1]);
      i++;
    } else if (arg.startsWith('--month=')) {
      options.month = arg.split('=')[1];
    } else if (arg === '--month' && args[i + 1]) {
      options.month = args[i + 1];
      i++;
    } else if (arg === '--all') {
      options.all = true;
    }
  }

  return options;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayName(date: Date): string {
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
}

/**
 * Authenticate with the API to get session cookie
 */
async function authenticateAPI(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });

    if (!response.ok) return false;

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/connect\.sid=([^;]+)/);
      if (match) {
        sessionCookie = `connect.sid=${match[1]}`;
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch overtime report from Frontend API
 */
async function fetchFrontendAPI(userId: number, year: number, month?: number): Promise<any | null> {
  try {
    const params = new URLSearchParams({ year: year.toString() });
    if (month) params.append('month', month.toString());

    const headers: Record<string, string> = {};
    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    const response = await fetch(`${API_BASE}/reports/overtime/user/${userId}?${params}`, { headers });
    const json = await response.json() as any;

    if (!json.success) return null;
    return json.data;
  } catch (error) {
    return null;
  }
}

/**
 * Compare calculated values with Frontend API
 */
async function validateFrontendAPI(
  userId: number,
  calculatedTarget: number,
  calculatedActual: number,
  calculatedOvertime: number,
  referenceMonth?: string
): Promise<void> {
  // Parse month to year and month number
  let year: number;
  let month: number | undefined;

  if (referenceMonth) {
    const [y, m] = referenceMonth.split('-').map(Number);
    year = y;
    month = m;
  } else {
    year = new Date().getFullYear();
  }

  console.log(`\n🌐 FRONTEND API VALIDATION`);
  console.log('─'.repeat(80));

  const apiData = await fetchFrontendAPI(userId, year, month);

  if (!apiData) {
    console.log('  ⚠️  Could not fetch from Frontend API (server not running or auth failed)');
    return;
  }

  const tolerance = 0.01; // 1 minute tolerance

  console.log(`Expected Target:    ${calculatedTarget}h`);
  console.log(`Frontend API Target:${apiData.summary.targetHours}h`);
  console.log(`Match:              ${Math.abs(calculatedTarget - apiData.summary.targetHours) < tolerance ? '✅ YES' : '❌ NO - MISMATCH!'}`);
  console.log('');
  console.log(`Expected Actual:    ${calculatedActual}h`);
  console.log(`Frontend API Actual:${apiData.summary.actualHours}h`);
  console.log(`Match:              ${Math.abs(calculatedActual - apiData.summary.actualHours) < tolerance ? '✅ YES' : '❌ NO - MISMATCH!'}`);
  console.log('');
  console.log(`Expected Overtime:  ${calculatedOvertime >= 0 ? '+' : ''}${calculatedOvertime}h`);
  console.log(`Frontend API OT:    ${apiData.summary.overtime >= 0 ? '+' : ''}${apiData.summary.overtime}h`);
  console.log(`Match:              ${Math.abs(calculatedOvertime - apiData.summary.overtime) < tolerance ? '✅ YES' : '❌ NO - MISMATCH!'}`);

  const hasDiscrepancy =
    Math.abs(calculatedTarget - apiData.summary.targetHours) >= tolerance ||
    Math.abs(calculatedActual - apiData.summary.actualHours) >= tolerance ||
    Math.abs(calculatedOvertime - apiData.summary.overtime) >= tolerance;

  if (hasDiscrepancy) {
    console.log('\n❌ FRONTEND API DISCREPANCY DETECTED!');
    console.log(`   Target Diff:   ${(calculatedTarget - apiData.summary.targetHours).toFixed(2)}h`);
    console.log(`   Actual Diff:   ${(calculatedActual - apiData.summary.actualHours).toFixed(2)}h`);
    console.log(`   Overtime Diff: ${(calculatedOvertime - apiData.summary.overtime).toFixed(2)}h`);
  }
}

async function validateOvertimeForUser(userId: number, referenceMonth?: string): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DETAILED OVERTIME VALIDATION');
  console.log('='.repeat(80) + '\n');

  // 1. Get user data
  const user = getUserById(userId);
  if (!user) {
    console.error(`❌ User with ID ${userId} not found!`);
    return;
  }

  console.log('👤 USER INFORMATION');
  console.log('─'.repeat(80));
  console.log(`Name:          ${user.firstName} ${user.lastName}`);
  console.log(`User ID:       ${user.id}`);
  console.log(`Hire Date:     ${user.hireDate}`);
  console.log(`Weekly Hours:  ${user.weeklyHours}h`);

  if (user.workSchedule) {
    console.log('\n📅 INDIVIDUAL WORK SCHEDULE:');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    for (let i = 0; i < days.length; i++) {
      const hours = user.workSchedule[days[i] as keyof typeof user.workSchedule] || 0;
      const indicator = hours > 0 ? '✅' : '❌';
      console.log(`  ${indicator} ${dayLabels[i].padEnd(12)} ${hours}h${hours === 0 ? ' (KEIN Arbeitstag!)' : ''}`);
    }
  } else {
    console.log('Work Schedule: Standard (Mo-Fr, weeklyHours / 5)');
  }

  // 2. Determine period
  // FIX: Use getCurrentDate() from timezone.ts to get Date in Berlin timezone
  const today = getCurrentDate();

  let startDate: Date;
  let endDate: Date;

  if (referenceMonth) {
    const [year, month] = referenceMonth.split('-').map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0);

    // If current month, only up to today
    const currentMonth = formatDate(today).substring(0, 7);
    if (referenceMonth === currentMonth) {
      endDate = today;
    }
  } else {
    startDate = new Date(user.hireDate);
    endDate = today;
  }

  // Respect hire date
  if (startDate < new Date(user.hireDate)) {
    startDate = new Date(user.hireDate);
  }

  console.log(`\n📆 CALCULATION PERIOD`);
  console.log('─'.repeat(80));
  console.log(`From:  ${formatDate(startDate)}`);
  console.log(`To:    ${formatDate(endDate)} ${ formatDate(endDate) === formatDate(today) ? '(TODAY)' : ''}`);
  console.log(`Days:  ${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1}`);

  // 3. Load holidays
  const holidays = db
    .prepare('SELECT date, name, federal FROM holidays WHERE date BETWEEN ? AND ?')
    .all(formatDate(startDate), formatDate(endDate)) as Array<{ date: string; name: string; federal: number }>;

  const holidayMap = new Map(holidays.map((h) => [h.date, h]));

  console.log(`\n🎉 HOLIDAYS (${holidays.length})`);
  console.log('─'.repeat(80));
  if (holidays.length === 0) {
    console.log('  (No holidays in this period)');
  } else {
    holidays.forEach((h) => {
      const federalLabel = h.federal === 1 ? '[Bundesweit]' : '[Länderspezifisch]';
      console.log(`  ${h.date}: ${h.name} ${federalLabel}`);
    });
  }

  // 4. Day-by-day breakdown
  console.log(`\n📊 DAY-BY-DAY BREAKDOWN`);
  console.log('─'.repeat(80));
  console.log('Date       | Day | Target | Holiday | Notes');
  console.log('─'.repeat(80));

  let totalTargetHours = 0;
  const dayDetails: Array<{ date: string; target: number; isHoliday: boolean; isWeekend: boolean }> = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const dayName = getDayName(d);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday = holidayMap.get(dateStr);
    const isHoliday = !!holiday;

    // CRITICAL FIX: Pass dateStr (string) instead of d (Date object)
    // The loop mutates d, causing timezone issues
    const dailyTarget = getDailyTargetHours(user, dateStr);

    totalTargetHours += dailyTarget;

    let notes = '';
    if (isWeekend) notes = 'Weekend';
    if (isHoliday) notes = `🎉 ${holiday.name}`;
    if (dailyTarget === 0 && !isWeekend && !isHoliday && user.workSchedule) {
      notes = '⚪ 0h day (workSchedule)';
    }

    dayDetails.push({ date: dateStr, target: dailyTarget, isHoliday, isWeekend });

    const targetStr = `${dailyTarget}h`.padEnd(6);
    const holidayStr = isHoliday ? 'YES' : 'NO';

    console.log(`${dateStr} | ${dayName} | ${targetStr} | ${holidayStr.padEnd(7)} | ${notes}`);
  }

  console.log('─'.repeat(80));
  console.log(`TOTAL TARGET HOURS: ${totalTargetHours}h`);

  // 5. Get absences - SPLIT INTO TWO QUERIES (Credits vs. Unpaid)
  // IMPORTANT: Match overtimeService.ts logic exactly!

  // 5a. Get absence CREDITS (vacation, sick, overtime_comp)
  const absenceCredits = db
    .prepare(
      `SELECT id, type, startDate, endDate, days
       FROM absence_requests
       WHERE userId = ?
         AND status = 'approved'
         AND type IN ('vacation', 'sick', 'overtime_comp')
         AND startDate <= ?
         AND endDate >= ?`
    )
    .all(userId, formatDate(endDate), formatDate(startDate)) as Array<{
    id: number;
    type: string;
    startDate: string;
    endDate: string;
    days: number;
  }>;

  // 5b. Get UNPAID absences (reduces target hours)
  const unpaidAbsences = db
    .prepare(
      `SELECT id, startDate, endDate, days
       FROM absence_requests
       WHERE userId = ?
         AND status = 'approved'
         AND type = 'unpaid'
         AND startDate <= ?
         AND endDate >= ?`
    )
    .all(userId, formatDate(endDate), formatDate(startDate)) as Array<{
    id: number;
    startDate: string;
    endDate: string;
    days: number;
  }>;

  const totalAbsences = absenceCredits.length + unpaidAbsences.length;

  console.log(`\n🏖️  ABSENCES (${totalAbsences})`);
  console.log('─'.repeat(80));

  let totalAbsenceCredits = 0;
  let totalUnpaidReduction = 0;

  if (totalAbsences === 0) {
    console.log('  (Keine Abwesenheiten in diesem Zeitraum)');
  } else {
    // Process CREDITS (vacation, sick, overtime_comp)
    absenceCredits.forEach((abs) => {
      const typeLabel =
        abs.type === 'vacation'
          ? '🏖️  Urlaub'
          : abs.type === 'sick'
            ? '🤒 Krank'
            : '⏰ Überstundenausgleich';

      console.log(`\n  ${typeLabel}: ${abs.startDate} bis ${abs.endDate} (Gesamt: ${abs.days} Kalendertage)`);

      // Calculate credit hours for this absence
      const absenceStart = new Date(Math.max(new Date(abs.startDate).getTime(), startDate.getTime()));
      const absenceEnd = new Date(Math.min(new Date(abs.endDate).getTime(), endDate.getTime()));

      let absenceDays = 0;
      let absenceHours = 0;
      const dayBreakdown: string[] = [];

      for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateStr = formatDate(d);
        const dayName = getDayName(d);
        const isHoliday = holidayMap.has(dateStr);

        if (isWeekend) {
          dayBreakdown.push(`     ${dateStr} (${dayName}) - Wochenende ❌`);
          continue;
        }

        if (isHoliday) {
          const holiday = holidayMap.get(dateStr)!;
          dayBreakdown.push(`     ${dateStr} (${dayName}) - ${holiday.name} 🎉 ❌`);
          continue;
        }

        const dailyHours = getDailyTargetHours(user, dateStr);

        if (dailyHours > 0) {
          absenceDays++;
          absenceHours += dailyHours;
          dayBreakdown.push(`     ${dateStr} (${dayName}) - ${dailyHours}h Gutschrift ✅`);
        } else {
          dayBreakdown.push(`     ${dateStr} (${dayName}) - 0h (kein Arbeitstag laut workSchedule) ❌`);
        }
      }

      console.log('  Tage-Aufschlüsselung:');
      dayBreakdown.forEach((line) => console.log(line));

      totalAbsenceCredits += absenceHours;
      console.log(`  → SUMME GUTSCHRIFT: ${absenceHours}h (${absenceDays} Arbeitstage mit Gutschrift)`);
    });

    // Process UNPAID absences (reduces target hours)
    unpaidAbsences.forEach((abs) => {
      console.log(`\n  💸 Unbezahlter Urlaub: ${abs.startDate} bis ${abs.endDate} (Gesamt: ${abs.days} Kalendertage)`);

      // Calculate reduction hours for this absence
      const absenceStart = new Date(Math.max(new Date(abs.startDate).getTime(), startDate.getTime()));
      const absenceEnd = new Date(Math.min(new Date(abs.endDate).getTime(), endDate.getTime()));

      let absenceDays = 0;
      let absenceHours = 0;
      const dayBreakdown: string[] = [];

      for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateStr = formatDate(d);
        const dayName = getDayName(d);
        const isHoliday = holidayMap.has(dateStr);

        if (isWeekend) {
          dayBreakdown.push(`     ${dateStr} (${dayName}) - Wochenende ❌`);
          continue;
        }

        if (isHoliday) {
          const holiday = holidayMap.get(dateStr)!;
          dayBreakdown.push(`     ${dateStr} (${dayName}) - ${holiday.name} 🎉 ❌`);
          continue;
        }

        const dailyHours = getDailyTargetHours(user, dateStr);

        if (dailyHours > 0) {
          absenceDays++;
          absenceHours += dailyHours;
          dayBreakdown.push(`     ${dateStr} (${dayName}) - ${dailyHours}h Soll-Reduktion ✅`);
        } else {
          dayBreakdown.push(`     ${dateStr} (${dayName}) - 0h (kein Arbeitstag laut workSchedule) ❌`);
        }
      }

      console.log('  Tage-Aufschlüsselung:');
      dayBreakdown.forEach((line) => console.log(line));

      totalUnpaidReduction += absenceHours;
      console.log(`  → SUMME SOLL-REDUKTION: ${absenceHours}h (${absenceDays} Arbeitstage reduziert)`);
    });
  }

  // 6. Get time entries - WITH DETAILED INFORMATION
  const timeEntries = db
    .prepare(
      `SELECT date, startTime, endTime, breakMinutes, hours, location, activity, project, notes
       FROM time_entries
       WHERE userId = ? AND date BETWEEN ? AND ?
       ORDER BY date, startTime`
    )
    .all(userId, formatDate(startDate), formatDate(endDate)) as Array<{
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    hours: number;
    location: string;
    activity: string | null;
    project: string | null;
    notes: string | null;
  }>;

  const totalWorkedHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);

  console.log(`\n⏱️  ZEITERFASSUNGEN (${timeEntries.length})`);
  console.log('─'.repeat(80));
  if (timeEntries.length === 0) {
    console.log('  (Keine Zeiterfassungen in diesem Zeitraum)');
  } else {
    // Group by date for better readability
    const entriesByDate = new Map<string, typeof timeEntries>();
    timeEntries.forEach((entry) => {
      if (!entriesByDate.has(entry.date)) {
        entriesByDate.set(entry.date, []);
      }
      entriesByDate.get(entry.date)!.push(entry);
    });

    entriesByDate.forEach((entries, date) => {
      const dayTotal = entries.reduce((sum, e) => sum + e.hours, 0);
      console.log(`\n  📅 ${date} (Summe: ${dayTotal}h)`);

      entries.forEach((entry, idx) => {
        const locationIcon = entry.location === 'office' ? '🏢' : entry.location === 'homeoffice' ? '🏠' : '🌍';
        console.log(`     ${idx + 1}. ${entry.startTime} - ${entry.endTime} (Pause: ${entry.breakMinutes} Min) = ${entry.hours}h ${locationIcon}`);

        if (entry.activity || entry.project) {
          const parts: string[] = [];
          if (entry.project) parts.push(`Projekt: ${entry.project}`);
          if (entry.activity) parts.push(`Tätigkeit: ${entry.activity}`);
          console.log(`        ${parts.join(' | ')}`);
        }

        if (entry.notes) {
          console.log(`        Notiz: ${entry.notes}`);
        }
      });
    });
  }
  console.log('\n  ─'.repeat(40));
  console.log(`  GESAMT GEARBEITET: ${totalWorkedHours}h`);

  // 7. Get overtime corrections
  const corrections = db
    .prepare(
      `SELECT date, hours, reason, correctionType FROM overtime_corrections
       WHERE userId = ? AND date BETWEEN ? AND ?
       ORDER BY date`
    )
    .all(userId, formatDate(startDate), formatDate(endDate)) as Array<{
    date: string;
    hours: number;
    reason: string;
    correctionType: string;
  }>;

  const totalCorrections = corrections.reduce((sum, c) => sum + c.hours, 0);

  console.log(`\n🔧 OVERTIME CORRECTIONS (${corrections.length})`);
  console.log('─'.repeat(80));
  if (corrections.length === 0) {
    console.log('  (No corrections in this period)');
  } else {
    corrections.forEach((c) => {
      const typeLabel =
        c.correctionType === 'system_error'
          ? '⚠️  System Error'
          : c.correctionType === 'absence_credit'
            ? '🏖️  Absence Credit'
            : c.correctionType === 'migration'
              ? '📦 Migration'
              : '✏️  Manual';
      console.log(`  ${c.date}: ${c.hours >= 0 ? '+' : ''}${c.hours}h (${typeLabel})`);
      console.log(`    Reason: ${c.reason}`);
    });
  }
  console.log(`  TOTAL CORRECTIONS: ${totalCorrections >= 0 ? '+' : ''}${totalCorrections}h`);

  // 8. Calculate overtime
  const adjustedTargetHours = totalTargetHours - totalUnpaidReduction;
  const actualHours = totalWorkedHours + totalAbsenceCredits + totalCorrections;
  const calculatedOvertime = actualHours - adjustedTargetHours;

  console.log(`\n🧮 CALCULATION`);
  console.log('─'.repeat(80));
  console.log(`Soll-Stunden (Target):          ${totalTargetHours}h`);
  console.log(`Unbezahlter Urlaub (Reduktion): -${totalUnpaidReduction}h`);
  console.log(`Angepasstes Soll:               ${adjustedTargetHours}h`);
  console.log('');
  console.log(`Gearbeitete Stunden:            ${totalWorkedHours}h`);
  console.log(`Abwesenheits-Gutschriften:      +${totalAbsenceCredits}h`);
  console.log(`Überstunden-Korrekturen:        ${totalCorrections >= 0 ? '+' : ''}${totalCorrections}h`);
  console.log(`Ist-Stunden (Actual):           ${actualHours}h`);
  console.log('');
  console.log(`ÜBERSTUNDEN (Ist - Soll):       ${calculatedOvertime >= 0 ? '+' : ''}${calculatedOvertime}h`);

  // 8. Database comparison
  if (referenceMonth) {
    const dbRecord = db
      .prepare('SELECT targetHours, actualHours, overtime FROM overtime_balance WHERE userId = ? AND month = ?')
      .get(userId, referenceMonth) as { targetHours: number; actualHours: number; overtime: number } | undefined;

    console.log(`\n💾 DATABASE COMPARISON (Month: ${referenceMonth})`);
    console.log('─'.repeat(80));

    if (!dbRecord) {
      console.log('  ⚠️  No database record found for this month!');
      console.log(`  Run: UPDATE overtime_balance for userId=${userId}, month=${referenceMonth}`);
    } else {
      console.log(`Expected Target:    ${adjustedTargetHours}h`);
      console.log(`DB Target:          ${dbRecord.targetHours}h`);
      console.log(`Match:              ${Math.abs(adjustedTargetHours - dbRecord.targetHours) < 0.01 ? '✅ YES' : '❌ NO - MISMATCH!'}`);
      console.log('');
      console.log(`Expected Actual:    ${actualHours}h`);
      console.log(`DB Actual:          ${dbRecord.actualHours}h`);
      console.log(`Match:              ${Math.abs(actualHours - dbRecord.actualHours) < 0.01 ? '✅ YES' : '❌ NO - MISMATCH!'}`);
      console.log('');
      console.log(`Expected Overtime:  ${calculatedOvertime >= 0 ? '+' : ''}${calculatedOvertime}h`);
      console.log(`DB Overtime:        ${dbRecord.overtime >= 0 ? '+' : ''}${dbRecord.overtime}h`);
      console.log(`Match:              ${Math.abs(calculatedOvertime - dbRecord.overtime) < 0.01 ? '✅ YES' : '❌ NO - MISMATCH!'}`);

      if (Math.abs(calculatedOvertime - dbRecord.overtime) >= 0.01) {
        console.log('\n❌ DISCREPANCY DETECTED!');
        console.log(`   Difference: ${(calculatedOvertime - dbRecord.overtime).toFixed(2)}h`);
        console.log(`   Recommendation: Recalculate overtime for this month`);
      }
    }
  }

  // 9. Frontend API Validation
  await validateFrontendAPI(userId, adjustedTargetHours, actualHours, calculatedOvertime, referenceMonth);

  console.log('\n' + '='.repeat(80) + '\n');
}

// Main execution
async function main() {
  const options = parseArgs();

  if (!options.userId && !options.all) {
    console.error('Usage:');
    console.error('  npm run validate:overtime:detailed -- --userId=<ID>');
    console.error('  npm run validate:overtime:detailed -- --userId=<ID> --month=2026-01');
    console.error('  npm run validate:overtime:detailed -- --all');
    process.exit(1);
  }

  // Try to authenticate with API for frontend validation
  console.log('🔐 Authenticating with API for frontend validation...');
  const authSuccess = await authenticateAPI();
  if (authSuccess) {
    console.log('✅ API authentication successful\n');
  } else {
    console.log('⚠️  API authentication failed (server not running?). Frontend validation will be skipped.\n');
  }

  if (options.all) {
    const users = db.prepare('SELECT id FROM users WHERE deletedAt IS NULL').all() as Array<{ id: number }>;
    console.log(`📋 Validating ${users.length} users...\n`);
    for (const user of users) {
      await validateOvertimeForUser(user.id, options.month);
    }
  } else if (options.userId) {
    await validateOvertimeForUser(options.userId, options.month);
  }

  db.close();
}

main().catch(error => {
  console.error('Fatal error:', error);
  db.close();
  process.exit(1);
});
