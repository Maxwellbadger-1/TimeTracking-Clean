/**
 * Backfill des Urlaubs-Journals.
 *
 *   npx tsx src/scripts/backfillVacationTransactions.ts            → Trockenlauf
 *   npx tsx src/scripts/backfillVacationTransactions.ts --apply    → schreibt
 *
 * Der Trockenlauf zeigt je Konto die geplanten Buchungen, ihre Summe, den Ist-Wert und die
 * Differenz. Erst mit --apply wird geschrieben — in EINER Transaktion über alle Konten.
 *
 * ABBRUCH VOR DEM SCHREIBEN, wenn für irgendein Konto die geplante Summe nicht dem Ist-Wert
 * entspricht. Lieber gar nicht als halb: Ein teilweise befülltes Journal wäre schlimmer als
 * gar keines, weil der Konsistenzprüfer dann echte von unfertigen Abweichungen nicht mehr
 * unterscheiden könnte.
 */

import { db } from '../database/connection.js';
import {
  buildBackfillPlan,
  hasExistingBackfill,
} from '../services/vacationBackfillService.js';
import { recordVacationTransaction } from '../services/vacationTransactionService.js';
import { checkVacationConsistency } from '../services/vacationConsistencyService.js';

const APPLY = process.argv.includes('--apply');

function totalRemaining2026(): number {
  const row = db.prepare(`
    SELECT ROUND(SUM(entitlement + carryover - taken), 2) AS s
    FROM vacation_balance vb JOIN users u ON u.id = vb.userId
    WHERE vb.year = 2026 AND u.deletedAt IS NULL
  `).get() as { s: number | null };
  return row.s ?? 0;
}

console.log(APPLY ? '### MODUS: SCHREIBEN ###\n' : '### TROCKENLAUF — es wird nichts geschrieben ###\n');

// ---------------------------------------------------------------- Idempotenz
if (hasExistingBackfill()) {
  console.log('*** ABBRUCH: Es existieren bereits rückwirkend erzeugte Buchungen.');
  console.log('*** Ein zweiter Lauf würde die Historie verdoppeln.');
  process.exit(1);
}

const remainingBefore = totalRemaining2026();
const plan = buildBackfillPlan();

// ---------------------------------------------------------------- Plan anzeigen
for (const acc of plan.accounts) {
  if (acc.entries.length === 0) continue;
  const flag = Math.abs(acc.plannedSum - acc.actualBalance) > 0.011 ? '  *** ABWEICHUNG ***' : '';
  console.log(`--- ${acc.userName}, ${acc.year} ---${flag}`);
  for (const e of acc.entries) {
    const sign = e.days > 0 ? '+' : '';
    console.log(
      `   ${e.date}  ${e.type.padEnd(18)} ${(sign + e.days).padStart(7)}  ` +
      `${e.referenceId ? '#' + e.referenceId + ' ' : ''}${e.description.replace(/ \(rückwirkend erzeugt\)/, '')}`
    );
  }
  console.log(
    `   → Summe ${acc.plannedSum}, Konto ${acc.actualBalance}` +
    (acc.reconciliation !== 0 ? `  (davon Ausgleich ${acc.reconciliation > 0 ? '+' : ''}${acc.reconciliation})` : '')
  );
  console.log();
}

console.log(`Konten: ${plan.accounts.length}   Buchungen: ${plan.totalEntries}`);
console.log(`Gesamt Verbleibend 2026 (unverändert erwartet): ${remainingBefore}\n`);

// ---------------------------------------------------------------- Abbruchbedingung
if (plan.mismatches.length > 0) {
  console.log('*** ABBRUCH: Für folgende Konten stimmt die geplante Summe nicht mit dem Ist-Wert überein:');
  for (const m of plan.mismatches) console.log('   ' + m);
  console.log('*** Es wurde NICHTS geschrieben.');
  process.exit(1);
}

console.log('✅ Alle Konten: geplante Summe entspricht dem Ist-Wert.\n');

if (!APPLY) {
  console.log('Trockenlauf beendet. Mit --apply ausführen.');
  process.exit(0);
}

// ---------------------------------------------------------------- Schreiben
console.log('=== Schreibe Buchungen ===');
const write = db.transaction(() => {
  let count = 0;
  for (const acc of plan.accounts) {
    for (const e of acc.entries) {
      recordVacationTransaction({
        userId: e.userId,
        year: e.year,
        date: e.date,
        type: e.type,
        days: e.days,
        description: e.description,
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        createdBy: null, // System — kein Mensch hat diese Buchung ausgelöst
      });
      count++;
    }
  }
  return count;
});

const written = write();
console.log(`✅ ${written} Buchungen geschrieben.\n`);

// ---------------------------------------------------------------- Kontrolle
const remainingAfter = totalRemaining2026();
console.log('=== Kontrolle ===');
console.log(`Gesamt Verbleibend 2026: ${remainingBefore} → ${remainingAfter}`);
if (Math.abs(remainingAfter - remainingBefore) > 0.011) {
  console.log('*** WARNUNG: Der Gesamtsaldo hat sich verändert! ***');
}

const report = checkVacationConsistency();
console.log(`Konsistenzprüfer: ${report.summary.error} Fehler, ${report.summary.warning} Warnungen, ${report.summary.info} Hinweise`);
for (const f of report.findings.filter(f => f.severity === 'error')) {
  console.log(`   FEHLER: ${f.userName} ${f.year ?? ''} — ${f.message}`);
}
console.log('integrity_check:', JSON.stringify(db.pragma('integrity_check')));
console.log(report.ok ? '\n### FERTIG — Journal konsistent ###' : '\n### FERTIG, ABER MIT FEHLERN ###');
