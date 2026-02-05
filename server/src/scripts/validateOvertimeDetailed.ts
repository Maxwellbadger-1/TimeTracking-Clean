/**
 * Detailed Overtime Validation Script
 *
 * Purpose: Comprehensive overtime calculation validation with 3-way comparison
 *
 * Usage:
 *   npm run validate:overtime:detailed -- --userId=3
 *   npm run validate:overtime:detailed -- --userId=3 --month=2026-01
 *   npm run validate:overtime:detailed -- --all
 *
 * Features:
 * - Day-by-day target hours breakdown with workSchedule visualization
 * - Holiday highlighting (federal + state-specific)
 * - Absence credit calculation (vacation, sick, overtime comp, unpaid)
 * - Time entries breakdown grouped by date
 * - Manual corrections tracking
 * - Overtime transactions analysis (earned, credits, adjustments, carryover)
 * - Visual calculation breakdown boxes (Target → Actual → Overtime)
 * - 3-way comparison table: Calculated vs Database vs Transactions
 * - Component-level breakdown for all calculation inputs
 * - Frontend API validation with discrepancy analysis
 * - Comprehensive validation status report
 *
 * Output Sections:
 * 1. User Information (work schedule, hire date)
 * 2. Calculation Period (from hire date to today/month-end)
 * 3. Holidays (all holidays in period)
 * 4. Day-by-Day Breakdown (target hours per day)
 * 5. Absences (credits vs unpaid, with day-by-day breakdown)
 * 6. Time Entries (grouped by date, with details)
 * 7. Overtime Corrections (manual adjustments)
 * 8. Overtime Transactions (by type: earned, credits, corrections, carryover)
 * 9. Detailed Calculation Breakdown (visual boxes)
 * 10. Three-Way Comparison (Calculated vs DB vs Transactions)
 * 11. Frontend API Validation (component-level comparison)
 */

import Database from 'better-sqlite3';
import { getUserById } from '../services/userService.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { getCurrentDate } from '../utils/timezone.js';
// @ts-expect-error - node-fetch doesn't have types in this project
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
 * Print a visual calendar for a month
 * Shows which days are working days, holidays, absences
 */
function printMonthCalendar(
  year: number,
  month: number,
  workDays: Set<string>,
  holidays: Map<string, { name: string; federal: number }>,
  absences: Set<string>
): void {
  console.log(`\n📅 CALENDAR - ${getMonthName(month)} ${year}`);
  console.log('─'.repeat(80));
  console.log('MO    DI    MI    DO    FR    SA    SO');
  console.log('─'.repeat(80));

  // Get first day of month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  // Get day of week for first day (0=Sunday, 1=Monday, etc.)
  let firstDayOfWeek = firstDay.getDay();
  // Convert to ISO (Monday=0, Sunday=6)
  firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  let calendar = '';

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendar += '      ';
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayNum = String(day).padStart(2, '0');

    let marker = ' ';
    if (holidays.has(dateStr)) {
      marker = '🎉'; // Holiday
    } else if (absences.has(dateStr)) {
      marker = '🏖️'; // Absence
    } else if (workDays.has(dateStr)) {
      marker = '✓'; // Work day
    }

    calendar += `${dayNum}${marker}   `;

    // New line after Sunday
    const currentDayOfWeek = (firstDayOfWeek + day - 1) % 7;
    if (currentDayOfWeek === 6) {
      calendar += '\n';
    }
  }

  console.log(calendar);
  console.log('─'.repeat(80));
  console.log('Legend: ✓=Work day  🎉=Holiday  🏖️=Absence  (blank)=Weekend/Non-work day');
}

function getMonthName(month: number): string {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return months[month - 1];
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
  totalWorkedHours: number,
  totalAbsenceCredits: number,
  totalCorrections: number,
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
  console.log('═'.repeat(80));

  const apiData = await fetchFrontendAPI(userId, year, month);

  if (!apiData) {
    console.log('  ⚠️  Could not fetch from Frontend API (server not running or auth failed)');
    return;
  }

  const tolerance = 0.01; // 1 minute tolerance

  // Summary comparison table
  console.log('\n┌────────────────────────┬──────────────┬──────────────┬────────┐');
  console.log('│ Component              │ Calculated   │ Frontend API │ Match  │');
  console.log('├────────────────────────┼──────────────┼──────────────┼────────┤');

  const targetMatch = Math.abs(calculatedTarget - apiData.summary.targetHours) < tolerance ? '✅' : '❌';
  const actualMatch = Math.abs(calculatedActual - apiData.summary.actualHours) < tolerance ? '✅' : '❌';
  const otMatch = Math.abs(calculatedOvertime - apiData.summary.overtime) < tolerance ? '✅' : '❌';

  console.log(`│ Target Hours (Soll)    │ ${calculatedTarget.toFixed(2).padStart(10)}h  │ ${apiData.summary.targetHours.toFixed(2).padStart(10)}h  │ ${targetMatch}     │`);
  console.log(`│ Actual Hours (Ist)     │ ${calculatedActual.toFixed(2).padStart(10)}h  │ ${apiData.summary.actualHours.toFixed(2).padStart(10)}h  │ ${actualMatch}     │`);
  console.log(`│ Overtime Balance       │ ${(calculatedOvertime >= 0 ? '+' : '') + calculatedOvertime.toFixed(2).padStart(9)}h  │ ${(apiData.summary.overtime >= 0 ? '+' : '') + apiData.summary.overtime.toFixed(2).padStart(9)}h  │ ${otMatch}     │`);
  console.log('└────────────────────────┴──────────────┴──────────────┴────────┘');

  const hasDiscrepancy =
    Math.abs(calculatedTarget - apiData.summary.targetHours) >= tolerance ||
    Math.abs(calculatedActual - apiData.summary.actualHours) >= tolerance ||
    Math.abs(calculatedOvertime - apiData.summary.overtime) >= tolerance;

  if (hasDiscrepancy) {
    console.log('\n📋 COMPONENT-LEVEL DISCREPANCY ANALYSIS:');
    console.log('─'.repeat(80));

    if (Math.abs(calculatedTarget - apiData.summary.targetHours) >= tolerance) {
      const targetDiff = calculatedTarget - apiData.summary.targetHours;
      console.log(`\n❌ TARGET HOURS MISMATCH:`);
      console.log(`   Calculated:     ${calculatedTarget}h`);
      console.log(`   Frontend API:   ${apiData.summary.targetHours}h`);
      console.log(`   Difference:     ${targetDiff >= 0 ? '+' : ''}${targetDiff.toFixed(2)}h`);
      console.log(`   → Check: workSchedule, holidays, unpaid leave handling`);
    }

    if (Math.abs(calculatedActual - apiData.summary.actualHours) >= tolerance) {
      const actualDiff = calculatedActual - apiData.summary.actualHours;
      console.log(`\n❌ ACTUAL HOURS MISMATCH:`);
      console.log(`   Calculated Components:`);
      console.log(`     - Time Entries:         ${totalWorkedHours}h`);
      console.log(`     - Absence Credits:      +${totalAbsenceCredits}h`);
      console.log(`     - Manual Corrections:   ${totalCorrections >= 0 ? '+' : ''}${totalCorrections}h`);
      console.log(`     - TOTAL:                ${calculatedActual}h`);
      console.log(`   Frontend API Total:       ${apiData.summary.actualHours}h`);
      console.log(`   Difference:               ${actualDiff >= 0 ? '+' : ''}${actualDiff.toFixed(2)}h`);
      console.log(`   → Check: absence credit calculation, corrections inclusion`);
    }

    if (Math.abs(calculatedOvertime - apiData.summary.overtime) >= tolerance) {
      const overtimeDiff = calculatedOvertime - apiData.summary.overtime;
      console.log(`\n❌ OVERTIME BALANCE MISMATCH:`);
      console.log(`   Calculated:     ${calculatedOvertime >= 0 ? '+' : ''}${calculatedOvertime}h`);
      console.log(`   Frontend API:   ${apiData.summary.overtime >= 0 ? '+' : ''}${apiData.summary.overtime}h`);
      console.log(`   Difference:     ${overtimeDiff >= 0 ? '+' : ''}${overtimeDiff.toFixed(2)}h`);
      console.log(`   → This is likely a DUAL CALCULATION SYSTEM issue!`);
      console.log(`   → Recommendation: Use overtime_balance (Single Source of Truth)`);
    }

    console.log('\n⚠️  FRONTEND API VALIDATION: FAILED');
    console.log('   The frontend API (reportService.ts) is calculating differently!');
    console.log('   This is the "Dual Calculation System" problem documented in ARCHITECTURE.md');
  } else {
    console.log('\n✅ FRONTEND API VALIDATION: PASSED');
    console.log('   All components match between calculated values and frontend API');
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

  // 3.5 Show visual calendar (if single month requested)
  if (referenceMonth) {
    // Collect work days from dayDetails
    const workDays = new Set<string>(
      dayDetails
        .filter(d => d.target > 0 && !d.isHoliday && !d.isWeekend)
        .map(d => d.date)
    );

    // Load absences for calendar display
    const allAbsences = db
      .prepare(
        `SELECT startDate, endDate
         FROM absence_requests
         WHERE userId = ?
           AND status = 'approved'
           AND startDate <= ?
           AND endDate >= ?`
      )
      .all(userId, formatDate(endDate), formatDate(startDate)) as Array<{
      startDate: string;
      endDate: string;
    }>;

    // Build absence dates set
    const absenceDates = new Set<string>();
    for (const absence of allAbsences) {
      const absStart = new Date(Math.max(new Date(absence.startDate).getTime(), startDate.getTime()));
      const absEnd = new Date(Math.min(new Date(absence.endDate).getTime(), endDate.getTime()));
      for (let d = new Date(absStart); d <= absEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        absenceDates.add(dateStr);
      }
    }

    printMonthCalendar(
      parseInt(referenceMonth.split('-')[0]),
      parseInt(referenceMonth.split('-')[1]),
      workDays,
      holidayMap,
      absenceDates
    );
  }

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

  // 8. Load overtime transactions
  const transactions = db
    .prepare(
      `SELECT id, date, type, hours, description, referenceType, referenceId
       FROM overtime_transactions
       WHERE userId = ? AND date BETWEEN ? AND ?
       ORDER BY date, type`
    )
    .all(userId, formatDate(startDate), formatDate(endDate)) as Array<{
    id: number;
    date: string;
    type: string;
    hours: number;
    description: string | null;
    referenceType: string | null;
    referenceId: number | null;
  }>;

  // Group transactions by type
  const transactionsByType = transactions.reduce((acc, t) => {
    if (!acc[t.type]) acc[t.type] = [];
    acc[t.type].push(t);
    return acc;
  }, {} as Record<string, typeof transactions>);

  console.log(`\n📊 OVERTIME TRANSACTIONS (${transactions.length})`);
  console.log('─'.repeat(80));
  if (transactions.length === 0) {
    console.log('  (No transactions in this period)');
  } else {
    // Show breakdown by type
    const typeLabels: Record<string, string> = {
      earned: '⏱️  Earned (Time Entries)',
      vacation_credit: '🏖️  Vacation Credit',
      sick_credit: '🤒 Sick Credit',
      overtime_comp_credit: '⏰ Overtime Comp Credit',
      special_credit: '🌟 Special Leave Credit',
      unpaid_adjustment: '💸 Unpaid Leave Adjustment',
      correction: '🔧 Manual Correction',
      carryover: '📦 Year-End Carryover',
    };

    Object.entries(transactionsByType).forEach(([type, txs]) => {
      const label = typeLabels[type] || `❓ ${type}`;
      const totalHours = txs.reduce((sum, t) => sum + t.hours, 0);
      console.log(`\n  ${label}: ${txs.length} transactions, ${totalHours >= 0 ? '+' : ''}${totalHours}h total`);

      // Show first 5 transactions, then summarize rest
      const displayLimit = 5;
      txs.slice(0, displayLimit).forEach((t, idx) => {
        const refInfo = t.referenceType && t.referenceId ? ` [Ref: ${t.referenceType}#${t.referenceId}]` : '';
        console.log(`     ${idx + 1}. ${t.date}: ${t.hours >= 0 ? '+' : ''}${t.hours}h${refInfo}`);
        if (t.description) {
          console.log(`        ${t.description}`);
        }
      });

      if (txs.length > displayLimit) {
        console.log(`     ... and ${txs.length - displayLimit} more transactions`);
      }
    });
  }

  // Calculate transaction totals for comparison
  const transactionTotals = {
    earned: transactionsByType.earned?.reduce((sum, t) => sum + t.hours, 0) || 0,
    vacationCredit: transactionsByType.vacation_credit?.reduce((sum, t) => sum + t.hours, 0) || 0,
    sickCredit: transactionsByType.sick_credit?.reduce((sum, t) => sum + t.hours, 0) || 0,
    overtimeCompCredit: transactionsByType.overtime_comp_credit?.reduce((sum, t) => sum + t.hours, 0) || 0,
    specialCredit: transactionsByType.special_credit?.reduce((sum, t) => sum + t.hours, 0) || 0,
    unpaidAdjustment: transactionsByType.unpaid_adjustment?.reduce((sum, t) => sum + t.hours, 0) || 0,
    correction: transactionsByType.correction?.reduce((sum, t) => sum + t.hours, 0) || 0,
    carryover: transactionsByType.carryover?.reduce((sum, t) => sum + t.hours, 0) || 0,
  };

  const transactionTotal = transactions.reduce((sum, t) => sum + t.hours, 0);

  console.log('\n  ─'.repeat(40));
  console.log(`  TRANSACTION BALANCE: ${transactionTotal >= 0 ? '+' : ''}${transactionTotal}h`);

  // 9. Calculate overtime
  const adjustedTargetHours = totalTargetHours - totalUnpaidReduction;
  const actualHours = totalWorkedHours + totalAbsenceCredits + totalCorrections;
  const calculatedOvertime = actualHours - adjustedTargetHours;

  console.log(`\n🧮 DETAILED CALCULATION BREAKDOWN`);
  console.log('═'.repeat(80));

  // Box 1: Target Hours Calculation
  console.log('\n┌─ TARGET HOURS (Soll-Stunden) ─────────────────────────────────────────────┐');
  console.log('│                                                                            │');
  console.log(`│  Base Target (Working Days):          ${totalTargetHours.toString().padStart(8)}h                    │`);
  console.log(`│  Unpaid Leave Reduction:              ${('-' + totalUnpaidReduction.toString()).padStart(8)}h                    │`);
  console.log('│  ──────────────────────────────────────────────────────────────────────  │');
  console.log(`│  ADJUSTED TARGET:                     ${adjustedTargetHours.toString().padStart(8)}h  ◄── Final Soll  │`);
  console.log('│                                                                            │');
  console.log('└────────────────────────────────────────────────────────────────────────────┘');

  // Box 2: Actual Hours Calculation
  console.log('\n┌─ ACTUAL HOURS (Ist-Stunden) ──────────────────────────────────────────────┐');
  console.log('│                                                                            │');
  console.log(`│  Time Entries (Worked):               ${('+' + totalWorkedHours.toString()).padStart(8)}h                    │`);
  console.log(`│  Absence Credits:                                                          │`);
  console.log(`│    ├─ Vacation/Sick/Overtime Comp:    ${('+' + totalAbsenceCredits.toString()).padStart(8)}h                    │`);
  console.log(`│  Manual Corrections:                  ${(totalCorrections >= 0 ? '+' : '') + totalCorrections.toString().padStart(8)}h                    │`);
  console.log('│  ──────────────────────────────────────────────────────────────────────  │');
  console.log(`│  TOTAL ACTUAL:                        ${actualHours.toString().padStart(8)}h  ◄── Final Ist   │`);
  console.log('│                                                                            │');
  console.log('└────────────────────────────────────────────────────────────────────────────┘');

  // Box 3: Overtime Calculation
  const overtimeSign = calculatedOvertime >= 0 ? '+' : '';
  console.log('\n┌─ OVERTIME (Überstunden) ──────────────────────────────────────────────────┐');
  console.log('│                                                                            │');
  console.log(`│  Actual Hours (Ist):                  ${actualHours.toString().padStart(8)}h                    │`);
  console.log(`│  Target Hours (Soll):                 ${('-' + adjustedTargetHours.toString()).padStart(8)}h                    │`);
  console.log('│  ──────────────────────────────────────────────────────────────────────  │');
  console.log(`│  OVERTIME BALANCE:                    ${(overtimeSign + calculatedOvertime.toString()).padStart(8)}h  ◄── Result     │`);
  console.log('│                                                                            │');
  console.log('└────────────────────────────────────────────────────────────────────────────┘');

  console.log('\n═'.repeat(80));

  // 10. Three-Way Comparison: Calculated vs Database vs Transactions
  if (referenceMonth) {
    const dbRecord = db
      .prepare('SELECT targetHours, actualHours, overtime FROM overtime_balance WHERE userId = ? AND month = ?')
      .get(userId, referenceMonth) as { targetHours: number; actualHours: number; overtime: number } | undefined;

    console.log(`\n🔀 THREE-WAY COMPARISON (Month: ${referenceMonth})`);
    console.log('═'.repeat(80));

    if (!dbRecord) {
      console.log('  ⚠️  No database record found in overtime_balance for this month!');
      console.log(`  Run: UPDATE overtime_balance for userId=${userId}, month=${referenceMonth}`);
      console.log('');
    }

    // Prepare values for table
    const calcTarget = adjustedTargetHours.toFixed(2);
    const calcActual = actualHours.toFixed(2);
    const calcOT = calculatedOvertime.toFixed(2);

    const dbTarget = dbRecord ? dbRecord.targetHours.toFixed(2) : 'N/A';
    const dbActual = dbRecord ? dbRecord.actualHours.toFixed(2) : 'N/A';
    const dbOT = dbRecord ? dbRecord.overtime.toFixed(2) : 'N/A';

    const txTarget = '—'; // Transactions don't store target
    const txActual = transactionTotal.toFixed(2);
    const txOT = transactionTotal.toFixed(2); // Transaction total IS the overtime balance

    // Match indicators
    const tolerance = 0.01;
    const targetMatch = dbRecord && Math.abs(adjustedTargetHours - dbRecord.targetHours) < tolerance ? '✅' : '❌';
    const actualMatch = dbRecord && Math.abs(actualHours - dbRecord.actualHours) < tolerance ? '✅' : '❌';
    const otMatch = dbRecord && Math.abs(calculatedOvertime - dbRecord.overtime) < tolerance ? '✅' : '❌';
    const txMatch = Math.abs(calculatedOvertime - transactionTotal) < tolerance ? '✅' : '❌';

    console.log('┌────────────────────────┬──────────────┬──────────────┬──────────────┬────────┐');
    console.log('│ Component              │ Calculated   │ Database     │ Transactions │ Match  │');
    console.log('├────────────────────────┼──────────────┼──────────────┼──────────────┼────────┤');
    console.log(`│ Target Hours (Soll)    │ ${calcTarget.padStart(10)}h  │ ${dbTarget.padStart(10)}h  │ ${txTarget.padStart(10)}   │ ${targetMatch}     │`);
    console.log(`│ Actual Hours (Ist)     │ ${calcActual.padStart(10)}h  │ ${dbActual.padStart(10)}h  │ ${txActual.padStart(10)}h  │ ${actualMatch}     │`);
    console.log(`│ Overtime Balance       │ ${(calculatedOvertime >= 0 ? '+' : '') + calcOT.padStart(9)}h  │ ${(dbRecord && dbRecord.overtime >= 0 ? '+' : '') + dbOT.padStart(9)}h  │ ${(transactionTotal >= 0 ? '+' : '') + txOT.padStart(9)}h  │ ${otMatch}${txMatch}   │`);
    console.log('└────────────────────────┴──────────────┴──────────────┴──────────────┴────────┘');

    // Detailed component breakdown
    console.log('\n📋 COMPONENT-LEVEL BREAKDOWN:');
    console.log('─'.repeat(80));

    console.log('\n🎯 TARGET HOURS:');
    console.log(`  Working Days Calculation:  ${totalTargetHours}h`);
    console.log(`  Unpaid Leave Reduction:    -${totalUnpaidReduction}h`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  CALCULATED TOTAL:          ${adjustedTargetHours}h`);
    if (dbRecord) {
      console.log(`  DATABASE TOTAL:            ${dbRecord.targetHours}h`);
      const targetDiff = adjustedTargetHours - dbRecord.targetHours;
      if (Math.abs(targetDiff) >= tolerance) {
        console.log(`  ❌ MISMATCH: ${targetDiff >= 0 ? '+' : ''}${targetDiff.toFixed(2)}h difference`);
      } else {
        console.log(`  ✅ MATCH`);
      }
    }

    console.log('\n⏱️  ACTUAL HOURS:');
    console.log(`  Time Entries (Worked):     ${totalWorkedHours}h`);
    console.log(`  Absence Credits:           +${totalAbsenceCredits}h`);
    console.log(`  Manual Corrections:        ${totalCorrections >= 0 ? '+' : ''}${totalCorrections}h`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  CALCULATED TOTAL:          ${actualHours}h`);
    if (dbRecord) {
      console.log(`  DATABASE TOTAL:            ${dbRecord.actualHours}h`);
      const actualDiff = actualHours - dbRecord.actualHours;
      if (Math.abs(actualDiff) >= tolerance) {
        console.log(`  ❌ MISMATCH: ${actualDiff >= 0 ? '+' : ''}${actualDiff.toFixed(2)}h difference`);
      } else {
        console.log(`  ✅ MATCH`);
      }
    }

    console.log('\n📊 TRANSACTION BREAKDOWN:');
    console.log(`  Earned (Time Entries):     ${transactionTotals.earned >= 0 ? '+' : ''}${transactionTotals.earned}h  (${transactionsByType.earned?.length || 0} txs)`);
    console.log(`  Vacation Credits:          +${transactionTotals.vacationCredit}h  (${transactionsByType.vacation_credit?.length || 0} txs)`);
    console.log(`  Sick Credits:              +${transactionTotals.sickCredit}h  (${transactionsByType.sick_credit?.length || 0} txs)`);
    console.log(`  Overtime Comp Credits:     +${transactionTotals.overtimeCompCredit}h  (${transactionsByType.overtime_comp_credit?.length || 0} txs)`);
    console.log(`  Special Credits:           +${transactionTotals.specialCredit}h  (${transactionsByType.special_credit?.length || 0} txs)`);
    console.log(`  Unpaid Adjustments:        ${transactionTotals.unpaidAdjustment}h  (${transactionsByType.unpaid_adjustment?.length || 0} txs)`);
    console.log(`  Manual Corrections:        ${transactionTotals.correction >= 0 ? '+' : ''}${transactionTotals.correction}h  (${transactionsByType.correction?.length || 0} txs)`);
    console.log(`  Year-End Carryover:        ${transactionTotals.carryover >= 0 ? '+' : ''}${transactionTotals.carryover}h  (${transactionsByType.carryover?.length || 0} txs)`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  TRANSACTION BALANCE:       ${transactionTotal >= 0 ? '+' : ''}${transactionTotal}h`);
    console.log(`  CALCULATED OVERTIME:       ${calculatedOvertime >= 0 ? '+' : ''}${calculatedOvertime}h`);
    const txDiff = calculatedOvertime - transactionTotal;
    if (Math.abs(txDiff) >= tolerance) {
      console.log(`  ❌ MISMATCH: ${txDiff >= 0 ? '+' : ''}${txDiff.toFixed(2)}h difference`);
    } else {
      console.log(`  ✅ MATCH`);
    }

    // Overall status
    console.log('\n🎯 VALIDATION STATUS:');
    console.log('─'.repeat(80));

    const hasDbMismatch = dbRecord && (
      Math.abs(adjustedTargetHours - dbRecord.targetHours) >= tolerance ||
      Math.abs(actualHours - dbRecord.actualHours) >= tolerance ||
      Math.abs(calculatedOvertime - dbRecord.overtime) >= tolerance
    );

    const hasTxMismatch = Math.abs(calculatedOvertime - transactionTotal) >= tolerance;

    if (!dbRecord) {
      console.log('  ⚠️  Database record missing - cannot validate');
    } else if (hasDbMismatch) {
      console.log('  ❌ DATABASE MISMATCH DETECTED!');
      console.log('     → Recommendation: Run overtime recalculation script');
    } else {
      console.log('  ✅ Database validation: PASSED');
    }

    if (hasTxMismatch) {
      console.log('  ❌ TRANSACTION MISMATCH DETECTED!');
      console.log(`     → Difference: ${txDiff >= 0 ? '+' : ''}${txDiff.toFixed(2)}h`);
      console.log('     → Possible causes:');
      console.log('       - Missing transactions (time entries/absences without transactions)');
      console.log('       - Extra transactions (orphaned or duplicate records)');
      console.log('       - Incorrect transaction types or hours');
    } else {
      console.log('  ✅ Transaction validation: PASSED');
    }
  }

  // 11. Frontend API Validation
  await validateFrontendAPI(
    userId,
    adjustedTargetHours,
    actualHours,
    calculatedOvertime,
    totalWorkedHours,
    totalAbsenceCredits,
    totalCorrections,
    referenceMonth
  );

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
