/**
 * Verify Test Data Script
 *
 * Verifiziert, dass die Test-Szenarien korrekt berechnet werden.
 * Vergleicht tatsächliche Werte aus der DB mit erwarteten Werten.
 *
 * Usage:
 *   npm run verify-test-data
 */

import { db } from '../database/connection.js';

console.log('🔍 Verifying Test Data...\n');

interface TestUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  weeklyHours: number;
}

interface ExpectedResults {
  targetHours: number;
  actualHours: number;
  overtime: number;
  vacationAvailable: number;
}

const EXPECTED_RESULTS: Record<string, ExpectedResults> = {
  david_test: {
    targetHours: 32,  // 4 Arbeitstage (Mi, Do, Fr, Mo) × 8h
    actualHours: 32,  // 4 Tage gearbeitet × 8h
    overtime: 0,      // 32h - 32h
    vacationAvailable: 30,
  },
  emma_test: {
    targetHours: 40,  // (6 Arbeitstage - 1 unbezahlt) × 8h = 5 × 8h
    actualHours: 40,  // 5 Tage gearbeitet × 8h (KEINE Gutschrift für unbezahlt!)
    overtime: 0,      // 40h - 40h
    vacationAvailable: 30, // unbezahlt zählt NICHT als Urlaub
  },
  frank_test: {
    targetHours: 48,  // 6 Arbeitstage × 8h
    actualHours: 54,  // 30h (3×10h) + 16h (2 Tage Gutschrift) + 8h (heute)
    overtime: 6,      // 54h - 48h
    vacationAvailable: 30, // Überstunden-Ausgleich zählt NICHT als Urlaub
  },
};

// Helper: Get user by username
function getTestUser(username: string): TestUser | null {
  const user = db
    .prepare('SELECT id, username, firstName, lastName, weeklyHours FROM users WHERE username = ?')
    .get(username) as TestUser | undefined;

  return user || null;
}

// Helper: Calculate target hours for December 2025 (from hire date to today)
function calculateTargetHours(userId: number, weeklyHours: number): number {
  // Get user's hire date
  const user = db.prepare('SELECT hireDate FROM users WHERE id = ?').get(userId) as { hireDate: string } | undefined;
  if (!user) return 0;

  const hireDate = new Date(user.hireDate);
  const today = new Date('2025-12-08'); // Mo 08.12.2025

  // Count working days from hire date to today (inclusive)
  let workingDays = 0;
  for (let d = new Date(hireDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
    if (!isWeekend) {
      workingDays++;
    }
  }

  // Check for unpaid leave (reduces target hours)
  const unpaidResult = db.prepare(`
    SELECT SUM(days) as totalDays
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type = 'unpaid'
      AND startDate >= '2025-12-01'
      AND endDate <= '2025-12-08'
  `).get(userId) as { totalDays: number | null } | undefined;

  const unpaidDays = unpaidResult?.totalDays || 0;

  const hoursPerDay = weeklyHours / 5; // 40h / 5 Tage = 8h
  return (workingDays - unpaidDays) * hoursPerDay;
}

// Helper: Calculate actual hours (worked + absences)
function calculateActualHours(userId: number, weeklyHours: number): number {
  const hoursPerDay = weeklyHours / 5;

  // Get worked hours
  const workedResult = db
    .prepare(`
      SELECT SUM(hours) as totalHours
      FROM time_entries
      WHERE userId = ?
        AND date >= '2025-12-01'
        AND date <= '2025-12-08'
    `)
    .get(userId) as { totalHours: number | null } | undefined;

  const workedHours = workedResult?.totalHours || 0;

  // Get absence credits (approved vacation, sick, and overtime_comp)
  // Note: unpaid leave gives NO credit!
  const absencesResult = db
    .prepare(`
      SELECT SUM(days) as totalDays
      FROM absence_requests
      WHERE userId = ?
        AND status = 'approved'
        AND type IN ('vacation', 'sick', 'overtime_comp')
        AND startDate >= '2025-12-01'
        AND endDate <= '2025-12-08'
    `)
    .get(userId) as { totalDays: number | null } | undefined;

  const absenceDays = absencesResult?.totalDays || 0;
  const absenceCredits = absenceDays * hoursPerDay;

  return workedHours + absenceCredits;
}

// Helper: Get vacation balance
function getVacationAvailable(userId: number): number {
  const result = db
    .prepare(`
      SELECT entitlement, carryover, taken
      FROM vacation_balance
      WHERE userId = ? AND year = 2025
    `)
    .get(userId) as { entitlement: number; carryover: number; taken: number } | undefined;

  if (!result) return 0;

  const entitlement = Number(result.entitlement) || 0;
  const carryover = Number(result.carryover) || 0;
  const taken = Number(result.taken) || 0;

  return entitlement + carryover - taken;
}

// Verification function
function verifyUser(username: string): boolean {
  const user = getTestUser(username);

  if (!user) {
    console.log(`❌ User "${username}" not found!`);
    return false;
  }

  const expected = EXPECTED_RESULTS[username];
  if (!expected) {
    console.log(`❌ No expected results defined for "${username}"`);
    return false;
  }

  console.log(`\n👤 ${user.firstName} ${user.lastName} (@${username})`);
  console.log('─'.repeat(60));

  // Calculate actual values
  const actualTargetHours = calculateTargetHours(user.id, user.weeklyHours);
  const actualActualHours = calculateActualHours(user.id, user.weeklyHours);
  const actualOvertime = actualActualHours - actualTargetHours;
  const actualVacationAvailable = getVacationAvailable(user.id);

  let hasErrors = false;

  // Compare Target Hours
  const targetMatch = Math.abs(actualTargetHours - expected.targetHours) < 0.1;
  console.log(
    `Soll-Stunden:      ${targetMatch ? '✅' : '❌'} Erwartet: ${expected.targetHours.toFixed(1)}h, Tatsächlich: ${actualTargetHours.toFixed(1)}h`
  );
  if (!targetMatch) hasErrors = true;

  // Compare Actual Hours
  const actualMatch = Math.abs(actualActualHours - expected.actualHours) < 0.1;
  console.log(
    `Ist-Stunden:       ${actualMatch ? '✅' : '❌'} Erwartet: ${expected.actualHours.toFixed(1)}h, Tatsächlich: ${actualActualHours.toFixed(1)}h`
  );
  if (!actualMatch) hasErrors = true;

  // Compare Overtime
  const overtimeMatch = Math.abs(actualOvertime - expected.overtime) < 0.1;
  console.log(
    `Überstunden:       ${overtimeMatch ? '✅' : '❌'} Erwartet: ${expected.overtime >= 0 ? '+' : ''}${expected.overtime.toFixed(1)}h, Tatsächlich: ${actualOvertime >= 0 ? '+' : ''}${actualOvertime.toFixed(1)}h`
  );
  if (!overtimeMatch) hasErrors = true;

  // Compare Vacation Available
  const vacationMatch = actualVacationAvailable === expected.vacationAvailable;
  console.log(
    `Urlaubstage:       ${vacationMatch ? '✅' : '❌'} Erwartet: ${expected.vacationAvailable} Tage, Tatsächlich: ${actualVacationAvailable} Tage`
  );
  if (!vacationMatch) hasErrors = true;

  return !hasErrors;
}

// Main verification
async function verify() {
  const testUsers = ['david_test', 'emma_test', 'frank_test'];

  let allPassed = true;

  for (const username of testUsers) {
    const passed = verifyUser(username);
    if (!passed) {
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (allPassed) {
    console.log('✅ Alle Tests bestanden!');
    console.log('\n📝 Die Berechnungen stimmen mit den erwarteten Werten überein.');
    console.log('🔍 Du kannst die Werte jetzt auch im Programm manuell überprüfen.');
  } else {
    console.log('❌ Einige Tests sind fehlgeschlagen!');
    console.log('\n🔍 Bitte überprüfe die Berechnungslogik in:');
    console.log('   - src/services/timeEntryService.ts');
    console.log('   - src/services/overtimeService.ts');
    console.log('   - src/services/vacationBalanceService.ts');
  }

  console.log('\n📄 Siehe seedTestData.ts und TEST_DATA_SEEDING_GUIDE.md für Details');
}

// Run verification
verify()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error verifying test data:', error);
    process.exit(1);
  });
