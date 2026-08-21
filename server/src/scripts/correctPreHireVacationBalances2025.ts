/**
 * Korrektur der 06-04-Pro-rata-Artefakte (06-07).
 *
 *   npx tsx src/scripts/correctPreHireVacationBalances2025.ts            → Trockenlauf
 *   npx tsx src/scripts/correctPreHireVacationBalances2025.ts --apply    → schreibt
 *
 * Vorgeschriebene Aufrufform gegen die Produktionsdatenbank (siehe .claude/CLAUDE.md,
 * Abschnitt „Database Rules" — ohne DATABASE_PATH legt getDatabasePath() beim
 * production-Fallback eine NEUE, LEERE Datei an statt die echte Produktionsdatenbank zu
 * öffnen):
 *
 *   DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
 *     npx tsx src/scripts/correctPreHireVacationBalances2025.ts [--apply]
 *
 * Kandidatenliste ist bewusst hartkodiert (Anwenderentscheidung, siehe 06-07-PLAN.md
 * <objective>) — kein automatisches Auffinden weiterer Konten. userId 1 (System-Administrator)
 * und userId 15 (Test Test, weichgelöscht) stehen absichtlich NICHT in der Liste: userId 1s
 * Eintrittsdatum (2025-11-13) liegt tatsächlich in 2025 und passt nicht zum hier behandelten
 * Fehlerbild (Eintritt NACH dem angefragten Jahr) — eine eigene, offene Anwenderentscheidung.
 * userId 15 ist weichgelöscht, von keinem künftigen Jahreswechsel betroffen, der Anwender hat
 * entschieden, dieses historische Artefakt nicht zu bereinigen.
 *
 * Der Trockenlauf zeigt je Kandidat, ob er eligible ist und welche Korrektur geplant wäre.
 * Erst --apply schreibt, in EINER Transaktion über alle eligible-Kandidaten dieses Laufs.
 */

import { db } from '../database/connection.js';
import databaseConfig from '../config/database.js';
import {
  buildPreHireCorrectionPlan,
  applyPreHireCorrection,
  type PreHireCorrectionCandidate,
  type PreHireCorrectionPlanEntryEligible,
} from '../services/preHireVacationCorrectionService.js';
import { getVacationBalanceFromTransactions } from '../services/vacationTransactionService.js';
import { checkVacationConsistency } from '../services/vacationConsistencyService.js';

// Kandidatenliste — bewusst hartkodiert, vom Anwender geprüft und freigegeben.
// userId 1 (System-Administrator, Eintritt tatsächlich 2025) und userId 15 (Test Test,
// weichgelöscht) stehen bewusst NICHT hier — siehe Kopfkommentar.
const CANDIDATES: PreHireCorrectionCandidate[] = [
  { userId: 2, year: 2025 },
  { userId: 3, year: 2025 },
];

const APPLY = process.argv.includes('--apply');

// Allererste Zeile: der aufgelöste Datenbankpfad — Lehre aus zwei gescheiterten
// Phase-8-Deployments (siehe .claude/CLAUDE.md, „Database Rules").
console.log('Datenbank:', databaseConfig.path);
console.log(APPLY ? '### MODUS: SCHREIBEN ###\n' : '### TROCKENLAUF — es wird nichts geschrieben ###\n');

const plan = buildPreHireCorrectionPlan(CANDIDATES);

for (const entry of plan) {
  if (entry.eligible) {
    console.log(
      `--- ${entry.userName} (userId ${entry.userId}), ${entry.year} --- eligible: true`
    );
    console.log(`   Geplante Korrektur: entitlement ${entry.currentEntitlement} → 0`);
  } else {
    console.log(`--- userId ${entry.userId}, ${entry.year} --- eligible: false`);
    console.log(`   Grund: ${entry.reason}`);
  }
}
console.log();

const eligibleEntries = plan.filter(
  (e): e is PreHireCorrectionPlanEntryEligible => e.eligible
);

if (eligibleEntries.length === 0) {
  console.log('Kein Kandidat eligible — nichts zu tun.');
  process.exit(0);
}

if (!APPLY) {
  console.log('Trockenlauf beendet. Mit --apply ausführen.');
  process.exit(0);
}

console.log('=== Schreibe Korrekturen ===');
const write = db.transaction(() => {
  for (const entry of eligibleEntries) {
    const before = getVacationBalanceFromTransactions(entry.userId, entry.year);
    applyPreHireCorrection(entry);
    const after = getVacationBalanceFromTransactions(entry.userId, entry.year);
    console.log(
      `   ${entry.userName} (userId ${entry.userId}), ${entry.year}: Journalsaldo ${before} → ${after}`
    );
  }
});
write();
console.log();

console.log('=== Kontrolle ===');
for (const entry of eligibleEntries) {
  const report = checkVacationConsistency({ userId: entry.userId, year: entry.year });
  console.log(
    `Konsistenzprüfer (${entry.userName}, ${entry.year}): ${report.summary.error} Fehler, ` +
    `${report.summary.warning} Warnungen, ${report.summary.info} Hinweise`
  );
  for (const f of report.findings.filter((f) => f.severity === 'error')) {
    console.log(`   FEHLER: ${f.userName} ${f.year ?? ''} — ${f.message}`);
  }
}
console.log('integrity_check:', JSON.stringify(db.pragma('integrity_check')));
console.log('\n### FERTIG ###');
