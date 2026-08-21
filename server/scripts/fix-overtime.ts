/**
 * Fix Overtime Script
 * Recalculates overtime for all users by ensuring all months from hire date to current month exist
 */

// Import database config to use correct database based on NODE_ENV
import { databaseConfig } from '../dist/config/database.js';
const dbPath = databaseConfig.path;

console.log(`📁 Using database: ${dbPath}`);

// Import timezone utility (CRITICAL: Use Europe/Berlin, NOT UTC!)
import { getCurrentMonth } from '../dist/utils/timezone.js';

/**
 * REQ-17 / Abweichung A-1 (09-INVENTAR-SOLLSTUNDEN.md, 09-A1-NACHWEIS.md): Dieses Skript
 * ermittelte Sollstunden früher selbst über `targetHoursPerDay = user.weeklyHours / 5` -
 * eine eigene, zweite Kopie der Logik aus overtimeService.ts, die kein `workSchedule` kannte.
 * Für Nutzer mit individuellem Wochenplan (z. B. userId 2, 17) berechnete das Skript falsche
 * Sollstunden und überschrieb per UPSERT jede zuvor korrekt berechnete `overtime_balance`-Zeile
 * bei jedem Deployment (.github/workflows/deploy-server.yml:118) und täglich um 3 Uhr per
 * Cronjob (deploy-server.yml:125).
 *
 * Angleichung (D1 - angleichen, nicht stilllegen): Statt der eigenen Kopie wird jetzt die
 * bereits exportierte, kanonische Funktion importiert:
 * server/src/services/overtimeService.ts:684 `ensureOvertimeBalanceEntries()`. Sie delegiert
 * intern an unifiedOvertimeService.calculateMonthlyOvertime(), das für jeden Tag
 * getDailyTargetHours() aufruft (server/src/utils/workingDays.ts:63) - denselben Maßstab wie
 * Dashboard und Berichte. Das Schreibverhalten bleibt identisch: derselbe UPSERT auf dieselben
 * zwei Spalten von overtime_balance (overtimeService.ts:767).
 *
 * Dieses Skript bleibt bestehen und läuft unverändert weiter (Auslieferungslogik, siehe
 * 09-A1-NACHWEIS.md, Abschnitt „Auslieferungslogik (Übergabe an Phase 14)"; der
 * Deploy-Workflow selbst wird in Phase 9 nicht geändert).
 */
import { ensureOvertimeBalanceEntries } from '../dist/services/overtimeService.js';
import { db } from '../dist/database/connection.js';

console.log('🔧 Starting overtime recalculation...\n');

// CRITICAL: Use Europe/Berlin timezone for correct month calculation
const currentMonth = getCurrentMonth();

// Get all active users
const users = db
  .prepare('SELECT id, firstName, lastName, hireDate FROM users WHERE deletedAt IS NULL')
  .all() as Array<{ id: number; firstName: string; lastName: string; hireDate: string }>;

console.log(`📊 Found ${users.length} active users\n`);

let totalProcessed = 0;
let totalUpdated = 0;

async function main(): Promise<void> {
  for (const user of users) {
    console.log(`👤 Processing: ${user.firstName} ${user.lastName} (ID: ${user.id})`);

    // Count existing entries before
    const beforeCount = db
      .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
      .get(user.id) as { count: number };

    // Kanonischer Weg statt eigener Kopie - siehe Kommentar oben (REQ-17, A-1)
    await ensureOvertimeBalanceEntries(user.id, currentMonth);

    // Count entries after
    const afterCount = db
      .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
      .get(user.id) as { count: number };

    const created = afterCount.count - beforeCount.count;
    const updated = afterCount.count; // All entries were processed (created or updated)
    totalUpdated += updated;
    totalProcessed++;

    if (created > 0) {
      console.log(`  📝 Created ${created} new month entries`);
    }
    console.log(`  🔄 Processed ${updated} total month entries`);

    // Show current total overtime (actualHours - targetHours)
    const totalResult = db
      .prepare('SELECT COALESCE(SUM(actualHours - targetHours), 0) as total FROM overtime_balance WHERE userId = ?')
      .get(user.id) as { total: number };

    console.log(`  ⏰ Total overtime: ${totalResult.total.toFixed(2)}h\n`);
  }

  console.log('✅ DONE!');
  console.log(`📊 Users processed: ${totalProcessed}`);
  console.log(`🔄 Total entries updated: ${totalUpdated}`);

  db.close();
}

main().catch((error) => {
  console.error('❌ FATAL:', error);
  process.exit(1);
});
