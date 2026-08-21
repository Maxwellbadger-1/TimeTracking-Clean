/**
 * CLI: Reproduziert den REQ-19-Kernbefund — „Überstundenausgleich (overtime_comp) erreicht
 * den Saldo nicht" — für einen konkreten Nutzer und Monat (D2, 09-CONTEXT.md).
 *
 * Nutzung:
 *   npm run repro:overtime-comp -- --userId=<n> --month=YYYY-MM
 *
 * PRODUKTIONSSCHUTZ (D5) — WARUM DER GUARD VOR JEDEM IMPORT STEHEN MUSS:
 * `server/src/database/connection.ts:50` ruft `initializeConnection()` als Top-Level-
 * Anweisung auf — das geschieht beim `import` des Moduls, nicht erst bei einem
 * Funktionsaufruf. `initializeConnection()` (`connection.ts:30-47`) öffnet
 * `new Database(DB_PATH)`, legt über `initializeDatabase(database)` (`schema.ts:9`) fehlende
 * Tabellen an (`CREATE TABLE IF NOT EXISTS`), erzeugt Indizes und setzt WAL-Pragmas;
 * `connection.ts:13-17` legt zuvor per `mkdirSync` das Verzeichnis an. `DB_PATH`
 * (`connection.ts:10`) stammt aus `databaseConfig.path` = `getDatabasePath()`, ebenfalls beim
 * Import ausgewertet (`server/src/config/database.ts:55-56`).
 * `unifiedOvertimeService.ts`, `overtimeTransactionService.ts` und `absenceService.ts`
 * importieren `db` statisch aus `../database/connection.js`. `../utils/workingDays.js`
 * importiert seinerseits `{ db } from '../database/connection.js'` und lädt die Verbindung
 * damit nachweislich transitiv. Eine statische `import`-Zeile auf eines dieser Module am
 * Dateikopf würde die Produktionsdatei also öffnen, BEVOR ein Laufzeit-Guard überhaupt läuft —
 * dasselbe Schadensmuster wie im Vorfall `.planning/debug/db-stabilisierung-20260818.md`.
 * `.claude/CLAUDE.md` → Database Rules verbietet genau das.
 *
 * Deshalb, zwingend in dieser Reihenfolge (Bauweise nach `compareOvertimePaths.ts`):
 *   1. Am Dateikopf ausschließlich import-sichere Module: Node-Builtins und `getDatabasePath`
 *      aus `../config/database.js` (löst nur einen String auf, öffnet keine Datei).
 *   2. Direkt danach, als allererste ausgeführte Anweisung: `assertNotProduction()` — eine
 *      SYNCHRONE Funktion auf Modulebene, nicht innerhalb von `main()`.
 *   3. Die Service-Module und die Datenbankverbindung selbst werden erst danach über
 *      dynamisches `await import(...)` innerhalb von `main()` geladen.
 *
 * Das Skript liest ausschließlich. Es ruft keine der fünf schreibenden Funktionen
 * (`getUserOvertimeReport`, `getOvertimeSummary`, `ensureOvertimeBalanceEntries`,
 * `updateMonthlyOvertime`, `rebuildOvertimeTransactionsForMonth`) auf.
 *
 * Exit-Codes: 0 = Ausgleich erreicht den Saldo (Differenz < 0.01h), 1 = Defekt reproduziert
 * (Differenz >= 0.01h — das erwartete Ergebnis dieses Laufs), 2 = Schutzabbruch/Bedienfehler.
 */

import path from 'path';
import { getDatabasePath } from '../config/database.js';

// ---------------------------------------------------------------------------------------
// Produktionsschutz (D5) — muss vor jedem Import eines Service-Moduls laufen, siehe Kopf.
// ---------------------------------------------------------------------------------------

function assertNotProduction(): void {
  const resolvedPath = getDatabasePath();
  const nodeEnv = process.env.NODE_ENV;

  if (resolvedPath.includes('production') || nodeEnv === 'production') {
    console.error('FEHLER: Produktionsschreibzugriff verweigert (D5, 09-CONTEXT.md).');
    console.error(`  Aufgelöster Datenbankpfad: ${resolvedPath}`);
    console.error(`  NODE_ENV: ${nodeEnv ?? '(nicht gesetzt)'}`);
    console.error(
      '  Grund: unifiedOvertimeService.ts, overtimeTransactionService.ts, absenceService.ts ' +
        'und utils/workingDays.ts importieren die Datenbankverbindung transitiv statisch; ' +
        'ein Import würde connection.ts:50 (initializeConnection()) beim Laden ausführen.'
    );
    console.error(
      '  Setze DATABASE_PATH auf eine lokale Entwicklungskopie, z. B. ./database/development.db'
    );
    process.exit(2);
  }
}

assertNotProduction();

// ---------------------------------------------------------------------------------------
// CLI-Argumente
// ---------------------------------------------------------------------------------------

interface CliOptions {
  userId: number;
  month: string;
}

function printUsageAndExit(): never {
  console.error('Nutzung:');
  console.error(
    '  npm run repro:overtime-comp -- --userId=<n> --month=YYYY-MM'
  );
  process.exit(2);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsageAndExit();
  }

  let userIdArg: number | undefined;
  let monthArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--userId=')) {
      userIdArg = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--userId' && args[i + 1]) {
      userIdArg = parseInt(args[++i], 10);
    } else if (arg.startsWith('--month=')) {
      monthArg = arg.split('=')[1];
    } else if (arg === '--month' && args[i + 1]) {
      monthArg = args[++i];
    }
  }

  const monthPattern = /^\d{4}-\d{2}$/;
  if (userIdArg === undefined || monthArg === undefined || Number.isNaN(userIdArg) || !monthPattern.test(monthArg)) {
    printUsageAndExit();
  }

  return { userId: userIdArg, month: monthArg };
}

// ---------------------------------------------------------------------------------------
// Hauptlauf — erst NACH dem Guard werden schreibende Service-Module dynamisch geladen.
// ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const { userId, month } = parseArgs();

  const { db } = await import('../database/connection.js');
  const { unifiedOvertimeService } = await import('../services/unifiedOvertimeService.js');
  const { calculateAbsenceHoursWithWorkSchedule } = await import('../utils/workingDays.js');

  // Startprotokoll gegen den Fehlgriff auf die tote server/database.db
  // (.planning/notes/db-pfad-diskrepanz-20260821.md).
  const absoluteDbPath = path.resolve(getDatabasePath());
  const activeUserCountRow = db
    .prepare('SELECT COUNT(*) as c FROM users WHERE deletedAt IS NULL')
    .get() as { c: number };

  console.log(`Datenbankpfad: ${absoluteDbPath}`);
  console.log(`Aktive Nutzer: ${activeUserCountRow.c}`);

  if (activeUserCountRow.c === 0) {
    console.error(
      'FEHLER: 0 aktive Nutzer in der geöffneten Datenbank — vermutlich falsche oder leere Datei.'
    );
    process.exit(2);
  }
  console.log('');

  // 1. Stammdaten des Nutzers
  const userRow = db
    .prepare(
      `SELECT id, firstName, lastName, weeklyHours, workSchedule, hireDate
       FROM users WHERE id = ? AND deletedAt IS NULL`
    )
    .get(userId) as
    | { id: number; firstName: string; lastName: string; weeklyHours: number; workSchedule: string | null; hireDate: string }
    | undefined;

  if (!userRow) {
    console.error(`FEHLER: Nutzer ${userId} nicht gefunden oder gelöscht.`);
    process.exit(2);
  }

  const workSchedule = userRow.workSchedule ? JSON.parse(userRow.workSchedule) : null;

  console.log('1. Stammdaten des Nutzers');
  console.log(`   Name: ${userRow.firstName} ${userRow.lastName} (userId ${userRow.id})`);
  console.log(`   weeklyHours: ${userRow.weeklyHours}`);
  console.log(`   workSchedule: ${userRow.workSchedule ?? '(nicht gesetzt)'}`);
  console.log(`   hireDate: ${userRow.hireDate}`);
  console.log('');

  // 2. Genehmigte overtime_comp-Anträge, die den Monat berühren
  const monthStart = `${month}-01`;
  const [yy, mm] = month.split('-').map(Number);
  const monthEnd = new Date(yy, mm, 0).toISOString().slice(0, 10);

  const compRequests = db
    .prepare(
      `SELECT id, startDate, endDate, days as daysRequired
       FROM absence_requests
       WHERE userId = ?
         AND type = 'overtime_comp'
         AND status = 'approved'
         AND startDate <= ?
         AND endDate >= ?`
    )
    .all(userId, monthEnd, monthStart) as Array<{
    id: number;
    startDate: string;
    endDate: string;
    daysRequired: number;
  }>;

  console.log('2. Genehmigte overtime_comp-Anträge im Monat');
  if (compRequests.length === 0) {
    console.log('   KEINE — der Defekt kann für diesen Nutzer/Monat nicht reproduziert werden.');
  }
  for (const r of compRequests) {
    console.log(
      `   id=${r.id} startDate=${r.startDate} endDate=${r.endDate} daysRequired=${r.daysRequired}`
    );
  }
  console.log('');

  // 3. erwarteterAbzug: Sollstunden des Ausgleichszeitraums
  let erwarteterAbzug = 0;
  for (const r of compRequests) {
    erwarteterAbzug += calculateAbsenceHoursWithWorkSchedule(
      r.startDate,
      r.endDate,
      workSchedule,
      userRow.weeklyHours
    );
  }
  erwarteterAbzug = Math.round(erwarteterAbzug * 100) / 100;

  console.log('3. erwarteterAbzug (Sollstunden des Ausgleichszeitraums)');
  console.log(`   erwarteterAbzug: ${erwarteterAbzug}h`);
  console.log('');

  // 4. overtime_transactions gruppiert nach type, für diesen Nutzer/Monat
  const txByType = db
    .prepare(
      `SELECT type, COUNT(*) as anzahl, COALESCE(SUM(hours), 0) as summe
       FROM overtime_transactions
       WHERE userId = ? AND date >= ? AND date <= ?
       GROUP BY type
       ORDER BY type`
    )
    .all(userId, monthStart, monthEnd) as Array<{ type: string; anzahl: number; summe: number }>;

  console.log('4. overtime_transactions gruppiert nach type');
  if (txByType.length === 0) {
    console.log('   KEINE Zeilen für diesen Monat.');
  }
  for (const row of txByType) {
    console.log(`   type=${row.type.padEnd(22)} anzahl=${row.anzahl} summe=${row.summe.toFixed(2)}h`);
  }
  const compensationRow = txByType.find(r => r.type === 'compensation');
  const overtimeCompCreditRow = txByType.find(r => r.type === 'overtime_comp_credit');
  console.log(
    `   compensation: ${compensationRow ? compensationRow.anzahl : 0} Zeile(n), ` +
      `Summe ${compensationRow ? compensationRow.summe.toFixed(2) : '0.00'}h`
  );
  console.log(
    `   overtime_comp_credit: ${overtimeCompCreditRow ? overtimeCompCreditRow.anzahl : 0} Zeile(n), ` +
      `Summe ${overtimeCompCreditRow ? overtimeCompCreditRow.summe.toFixed(2) : '0.00'}h`
  );
  console.log('');

  // 5. overtime_balance-Zeile für (userId, month)
  const balanceRow = db
    .prepare(
      `SELECT targetHours, actualHours, overtime
       FROM overtime_balance
       WHERE userId = ? AND month = ?`
    )
    .get(userId, month) as { targetHours: number; actualHours: number; overtime: number } | undefined;

  console.log('5. overtime_balance-Zeile');
  if (!balanceRow) {
    console.log('   KEINE Zeile vorhanden.');
  } else {
    console.log(
      `   targetHours=${balanceRow.targetHours} actualHours=${balanceRow.actualHours} overtime=${balanceRow.overtime}`
    );
  }
  console.log('');

  // 6. unifiedOvertimeService.calculateMonthlyOvertime() mit vollem breakdown
  const monthlyResult = unifiedOvertimeService.calculateMonthlyOvertime(userId, month);

  console.log('6. unifiedOvertimeService.calculateMonthlyOvertime() breakdown');
  console.log(`   targetHours=${monthlyResult.targetHours} actualHours=${monthlyResult.actualHours} overtime=${monthlyResult.overtime}`);
  console.log(`   breakdown.worked=${monthlyResult.breakdown.worked}`);
  console.log(`   breakdown.absenceCredits=${monthlyResult.breakdown.absenceCredits}`);
  console.log(`   breakdown.corrections=${monthlyResult.breakdown.corrections}`);
  console.log(`   breakdown.unpaidReduction=${monthlyResult.breakdown.unpaidReduction}`);
  console.log('');

  // 7. calculateDailyOvertime() für jeden Tag des Ausgleichszeitraums
  console.log('7. calculateDailyOvertime() je Tag des Ausgleichszeitraums');
  for (const r of compRequests) {
    for (let d = new Date(r.startDate + 'T12:00:00'); d <= new Date(r.endDate + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dailyResult = unifiedOvertimeService.calculateDailyOvertime(userId, dateStr);
      console.log(
        `   ${dateStr}: targetHours=${dailyResult.targetHours} actualHours=${dailyResult.actualHours} ` +
          `overtime=${dailyResult.overtime} breakdown.absenceCredit=${dailyResult.breakdown.absenceCredit}`
      );
    }
  }
  console.log('');

  // 8. Gegenüberstellung
  const tatsaechlicherSaldo = monthlyResult.overtime;
  const erwarteterSaldo = tatsaechlicherSaldo - erwarteterAbzug;
  // Für die eigentliche Reproduktion vergleichen wir NICHT den absoluten Saldo (der hängt
  // von allen Tagen des Monats ab), sondern ob der Ausgleichstag selbst saldoneutral bleibt:
  // Das ist die absenceCredit-Summe über die Ausgleichstage aus Schritt 7 — sie MUSS 0 sein,
  // wenn der Defekt behoben ist (kein Credit für overtime_comp), und > 0, wenn der Defekt
  // vorliegt (overtime_comp wird wie vacation/sick kreditiert).
  let absenceCreditSummeAusgleichstage = 0;
  for (const r of compRequests) {
    for (let d = new Date(r.startDate + 'T12:00:00'); d <= new Date(r.endDate + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dailyResult = unifiedOvertimeService.calculateDailyOvertime(userId, dateStr);
      absenceCreditSummeAusgleichstage += dailyResult.breakdown.absenceCredit;
    }
  }
  const differenz = Math.round(absenceCreditSummeAusgleichstage * 100) / 100;

  console.log('8. Gegenüberstellung');
  console.log(`   tatsächlicherSaldo (unified, Monat ${month}): ${tatsaechlicherSaldo}h`);
  console.log(`   erwarteterAbzug: ${erwarteterAbzug}h`);
  console.log(`   erwarteterSaldo (tatsächlicherSaldo - erwarteterAbzug): ${erwarteterSaldo}h`);
  console.log(
    `   absenceCredit-Summe über die Ausgleichstage (muss 0 sein, wenn der Ausgleich den Saldo erreicht): ${differenz}h`
  );
  console.log(`   Differenz (absenceCredit-Summe der Ausgleichstage): ${differenz}h`);
  console.log('');

  if (compRequests.length === 0) {
    console.error('FEHLER: Keine genehmigten overtime_comp-Anträge für diesen Nutzer/Monat — kein Reproduktionsfall.');
    process.exit(2);
  }

  if (differenz < 0.01) {
    console.log('ERGEBNIS: Der Ausgleich hat den Saldo erreicht (Differenz < 0.01h). Exit 0.');
    process.exit(0);
  }

  console.log('ERGEBNIS: Der Ausgleich hat den Saldo NICHT erreicht — Defekt reproduziert. Exit 1.');
  process.exit(1);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
