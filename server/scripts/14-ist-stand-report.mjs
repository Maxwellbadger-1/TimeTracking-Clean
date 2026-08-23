/**
 * CLI: Erhebt den namentlichen, wertgenauen Ist-Stand einer Datenbank — Stunden UND Urlaub,
 * je Nutzer — als JSON und als lesbare Tabelle.
 *
 * WARUM DIESES WERKZEUG ZUSÄTZLICH ZU `snapshot:balances` EXISTIERT (Zusatzauflage zu Plan
 * 14-08):
 * `src/scripts/snapshotBalances.ts` erhebt den Saldo über den kanonischen Rechenweg
 * (`unifiedOvertimeService.calculatePeriodOvertime()`). Dieser Weg löst seit Phase 11 über
 * `user_work_periods` auf und wirft gegen eine Datenbank OHNE diese Tabelle für jeden Nutzer
 * „Keine Arbeitszeitperiode gefunden — D4: kein Rückfall auf users.weeklyHours". Gegen den
 * Stand VOR den Migrationen 008–015 ist er damit nicht verwendbar.
 *
 * Dieses Werkzeug liest ausschließlich ROHE TABELLENWERTE und funktioniert deshalb auf
 * beiden Seiten des Migrationsschnitts identisch — es ist der Vergleichsmaßstab für die
 * Zusicherung „an den Stundenständen darf sich nichts ändern, es darf nichts verloren gehen".
 *
 * Es ergänzt `snapshot:balances`, es ersetzt es nicht: Der kanonische Rechenweg bleibt der
 * maßgebliche Nachweis für den Saldo, den die Anwendung anzeigt, und wird gegen die migrierte
 * Kopie zusätzlich erhoben.
 *
 * NAMENTLICH UND VOLLSTÄNDIG:
 * `SELECT ... FROM users` ohne `WHERE deletedAt IS NULL`. Soft-gelöschte Nutzer bleiben Teil
 * der Population und werden im Bericht getrennt ausgewiesen — „nicht auflösbar" ist als
 * Ist-Stand nicht ausreichend, wenn zugesichert ist, dass nichts verloren geht.
 *
 * AUSSCHLIESSLICH LESEND:
 * Jede Datenbankverbindung wird mit `{ readonly: true }` geöffnet. Dieses Werkzeug enthält
 * kein INSERT, UPDATE, DELETE oder VACUUM.
 *
 * Nutzung:
 *   node scripts/14-ist-stand-report.mjs --db=<pfad> --out=<basispfad-ohne-endung> --label="<text>"
 */

import { createHash } from 'crypto';
import { existsSync, statSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------------------
// Argumentauswertung — --db ist Pflicht, kein Rückfall auf getDatabasePath()
// ---------------------------------------------------------------------------------------

function usage(message) {
  if (message) console.error(`FEHLER: ${message}`);
  console.error('Nutzung:');
  console.error('  node scripts/14-ist-stand-report.mjs --db=<pfad> --out=<basispfad> --label="<text>"');
  console.error('  --db, --out und --label sind Pflicht. Kein Rückfall auf eine Standarddatenbank.');
  process.exit(2);
}

let dbPath;
let outBase;
let label;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--db=')) dbPath = arg.slice('--db='.length);
  else if (arg.startsWith('--out=')) outBase = arg.slice('--out='.length);
  else if (arg.startsWith('--label=')) label = arg.slice('--label='.length);
  else usage(`unbekanntes Argument: "${arg}"`);
}
if (!dbPath) usage('--db fehlt.');
if (!outBase) usage('--out fehlt.');
if (!label) usage('--label fehlt.');

const resolvedDb = path.resolve(dbPath);
if (!existsSync(resolvedDb)) usage(`Datenbankdatei existiert nicht: ${resolvedDb}`);

// ---------------------------------------------------------------------------------------
// Erhebung
// ---------------------------------------------------------------------------------------

const db = new Database(resolvedDb, { readonly: true });

const hasTable = (name) =>
  !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

const hasUwp = hasTable('user_work_periods');
// Migration 013 fügt deletedAt zu user_work_periods hinzu; vorher gibt es die Spalte nicht.
const uwpHasDeletedAt =
  hasUwp && db.prepare('PRAGMA table_info(user_work_periods)').all().some((c) => c.name === 'deletedAt');

const round6 = (v) => (v === null || v === undefined ? null : Math.round(v * 1e6) / 1e6);

const userRows = db
  .prepare(
    `SELECT id, firstName, lastName, username, role, department, position,
            weeklyHours, workSchedule, vacationDaysPerYear,
            hireDate, endDate, status, deletedAt
     FROM users ORDER BY id ASC`
  )
  .all();

const users = userRows.map((u) => {
  const obRows = db
    .prepare(
      `SELECT month, targetHours, actualHours, overtime, carryoverFromPreviousYear
       FROM overtime_balance WHERE userId = ? ORDER BY month ASC`
    )
    .all(u.id);

  const obTotals = db
    .prepare(
      `SELECT COUNT(*) c,
              ROUND(SUM(targetHours),6) sumTarget,
              ROUND(SUM(actualHours),6) sumActual,
              ROUND(SUM(overtime),6) sumOvertime,
              ROUND(SUM(COALESCE(carryoverFromPreviousYear,0)),6) sumCarryover
       FROM overtime_balance WHERE userId = ?`
    )
    .get(u.id);

  const otTotals = db
    .prepare(
      `SELECT COUNT(*) c, ROUND(SUM(hours),6) sumHours
       FROM overtime_transactions WHERE userId = ?`
    )
    .get(u.id);

  const teTotals = db
    .prepare(
      `SELECT COUNT(*) c, ROUND(SUM(hours),6) sumHours, MIN(date) minDate, MAX(date) maxDate
       FROM time_entries WHERE userId = ?`
    )
    .get(u.id);

  const yearRows = db
    .prepare(
      `SELECT year FROM (
         SELECT year FROM vacation_balance WHERE userId = ?
         UNION
         SELECT year FROM vacation_transactions WHERE userId = ?
       ) ORDER BY year ASC`
    )
    .all(u.id, u.id);

  const vacationYears = yearRows.map(({ year }) => {
    const b = db
      .prepare(
        `SELECT entitlement, carryover, taken, remaining
         FROM vacation_balance WHERE userId = ? AND year = ?`
      )
      .get(u.id, year);
    const tx = db
      .prepare(
        `SELECT COUNT(*) c, ROUND(COALESCE(SUM(days),0),6) sumDays
         FROM vacation_transactions WHERE userId = ? AND year = ?`
      )
      .get(u.id, year);
    return {
      year,
      entitlement: b ? round6(b.entitlement) : null,
      carryover: b ? round6(b.carryover) : null,
      taken: b ? round6(b.taken) : null,
      remaining: b ? round6(b.remaining) : null,
      transactionsCount: tx.c,
      transactionsSumDays: round6(tx.sumDays),
    };
  });

  const absenceTotals = db
    .prepare(
      `SELECT COUNT(*) c FROM absence_requests WHERE userId = ?`
    )
    .get(u.id);

  let workPeriods = null;
  if (hasUwp) {
    workPeriods = db
      .prepare(
        `SELECT id, validFrom, validTo, weeklyHours, workSchedule${uwpHasDeletedAt ? ', deletedAt' : ''}
         FROM user_work_periods WHERE userId = ? ORDER BY validFrom ASC, id ASC`
      )
      .all(u.id);
  }

  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    role: u.role,
    department: u.department,
    position: u.position,
    deletedAt: u.deletedAt,
    status: u.status,
    hireDate: u.hireDate,
    endDate: u.endDate,
    weeklyHours: round6(u.weeklyHours),
    workSchedule: u.workSchedule,
    vacationDaysPerYear: u.vacationDaysPerYear,
    overtimeBalance: {
      monthCount: obTotals.c,
      sumTargetHours: round6(obTotals.sumTarget),
      sumActualHours: round6(obTotals.sumActual),
      sumOvertime: round6(obTotals.sumOvertime),
      sumCarryover: round6(obTotals.sumCarryover),
      months: obRows.map((r) => ({
        month: r.month,
        targetHours: round6(r.targetHours),
        actualHours: round6(r.actualHours),
        overtime: round6(r.overtime),
        carryoverFromPreviousYear: round6(r.carryoverFromPreviousYear),
      })),
    },
    overtimeTransactions: { count: otTotals.c, sumHours: round6(otTotals.sumHours) },
    timeEntries: {
      count: teTotals.c,
      sumHours: round6(teTotals.sumHours),
      minDate: teTotals.minDate,
      maxDate: teTotals.maxDate,
    },
    absenceRequests: { count: absenceTotals.c },
    vacationYears,
    workPeriods,
  };
});

const tableCounts = {};
for (const t of [
  'users',
  'time_entries',
  'absence_requests',
  'overtime_transactions',
  'overtime_balance',
  'vacation_balance',
  'vacation_transactions',
  'user_work_periods',
]) {
  tableCounts[t] = hasTable(t) ? db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c : null;
}

const migrations = db
  .prepare('SELECT name FROM migrations ORDER BY id')
  .all()
  .map((r) => r.name);

const integrity = db.pragma('integrity_check');
const foreignKeys = db.pragma('foreign_key_check');

db.close();

// ---------------------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------------------

// `generatedAt` und `databasePath` sind bewusst NICHT Teil des gehashten Nutzdatenkerns:
// zwei Erhebungen desselben Datenstands sollen denselben SHA-256 liefern, sonst wäre der
// Hash als Gleichheitsnachweis wertlos.
const payload = {
  schemaVersion: 1,
  tableCounts,
  migrations,
  integrityCheck: integrity,
  foreignKeyCheck: foreignKeys,
  users,
};

const envelope = {
  label,
  generatedAt: new Date().toISOString(),
  databasePath: resolvedDb,
  databaseSizeBytes: statSync(resolvedDb).size,
  ...payload,
};

const jsonPath = `${outBase}.json`;
writeFileSync(jsonPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf-8');

const payloadJson = JSON.stringify(payload);
const payloadHash = createHash('sha256').update(payloadJson, 'utf-8').digest('hex');
const fileHash = createHash('sha256').update(readFileSync(jsonPath)).digest('hex');

// --- Markdown-Tabelle ---
const fmt = (v) => (v === null || v === undefined ? '—' : String(v));
const lines = [];
lines.push(`# Ist-Stand — ${label}`);
lines.push('');
lines.push(`**Datenbank:** \`${resolvedDb}\` (${statSync(resolvedDb).size} Bytes)`);
lines.push(`**Erhoben:** ${envelope.generatedAt}`);
lines.push(`**Erhebungsweise:** ausschliesslich readonly, rohe Tabellenwerte (kein Rechenweg).`);
lines.push('');
lines.push(`**SHA-256 des Nutzdatenkerns** (ohne \`label\`/\`generatedAt\`/\`databasePath\`/\`databaseSizeBytes\`):`);
lines.push('');
lines.push('```');
lines.push(payloadHash);
lines.push('```');
lines.push('');
lines.push(`**SHA-256 der gesamten JSON-Datei:** \`${fileHash}\``);
lines.push('');
lines.push('## Tabellenzählwerte');
lines.push('');
lines.push('| Tabelle | Zeilen |');
lines.push('|---|---|');
for (const [t, c] of Object.entries(tableCounts)) {
  lines.push(`| \`${t}\` | ${c === null ? '*Tabelle nicht vorhanden*' : c} |`);
}
lines.push('');
lines.push(`\`integrity_check\`: \`${JSON.stringify(integrity)}\` — \`foreign_key_check\`: \`${JSON.stringify(foreignKeys)}\``);
lines.push('');
lines.push(`Angewendete Migrationen (${migrations.length}): ${migrations.map((m) => `\`${m}\``).join(', ')}`);
lines.push('');
lines.push('## Stundenstand je Nutzer');
lines.push('');
lines.push('`Soll`/`Ist`/`Saldo` sind die Summen über alle in `overtime_balance` erfassten Monate.');
lines.push('');
lines.push('| ID | Name | gelöscht | Wochenstunden | Wochenplan | Monate | Soll (h) | Ist (h) | Saldo (h) | Buchungen | Buchungssumme (h) | Zeiteinträge | Zeiteintragssumme (h) |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const u of users) {
  lines.push(
    `| ${u.id} | ${u.firstName} ${u.lastName} | ${u.deletedAt ? `ja (${u.deletedAt})` : 'nein'} | ${fmt(u.weeklyHours)} | ${u.workSchedule ? `\`${u.workSchedule}\`` : '—'} | ${u.overtimeBalance.monthCount} | ${fmt(u.overtimeBalance.sumTargetHours)} | ${fmt(u.overtimeBalance.sumActualHours)} | ${fmt(u.overtimeBalance.sumOvertime)} | ${u.overtimeTransactions.count} | ${fmt(u.overtimeTransactions.sumHours)} | ${u.timeEntries.count} | ${fmt(u.timeEntries.sumHours)} |`
  );
}
lines.push('');
lines.push('## Urlaubsstand je Nutzer und Jahr');
lines.push('');
lines.push('| ID | Name | gelöscht | Jahr | Anspruch | Übertrag | genommen | Rest | Buchungen | Buchungssumme (Tage) |');
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const u of users) {
  if (u.vacationYears.length === 0) {
    lines.push(
      `| ${u.id} | ${u.firstName} ${u.lastName} | ${u.deletedAt ? 'ja' : 'nein'} | *kein Jahr erfasst* | — | — | — | — | — | — |`
    );
    continue;
  }
  for (const v of u.vacationYears) {
    lines.push(
      `| ${u.id} | ${u.firstName} ${u.lastName} | ${u.deletedAt ? 'ja' : 'nein'} | ${v.year} | ${fmt(v.entitlement)} | ${fmt(v.carryover)} | ${fmt(v.taken)} | ${fmt(v.remaining)} | ${v.transactionsCount} | ${fmt(v.transactionsSumDays)} |`
    );
  }
}
lines.push('');
const deleted = users.filter((u) => u.deletedAt);
lines.push('## Soft-gelöschte Nutzer — gesondert ausgewiesen');
lines.push('');
lines.push(
  `Der kanonische Rechenweg (\`unifiedOvertimeService\`) löst diese Nutzer nicht auf und liefert für sie \`"User <id> not found"\`. Ihre Werte stehen deshalb hier direkt aus den Tabellen — sie sind Teil des Ist-Stands und dürfen nicht verloren gehen. Anzahl: **${deleted.length}**.`
);
lines.push('');
if (deleted.length > 0) {
  lines.push('| ID | Name | gelöscht am | Wochenstunden | Monate | Saldo (h) | Buchungen | Zeiteinträge | Urlaubsjahre |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const u of deleted) {
    lines.push(
      `| ${u.id} | ${u.firstName} ${u.lastName} | ${u.deletedAt} | ${fmt(u.weeklyHours)} | ${u.overtimeBalance.monthCount} | ${fmt(u.overtimeBalance.sumOvertime)} | ${u.overtimeTransactions.count} | ${u.timeEntries.count} | ${u.vacationYears.map((v) => v.year).join(', ') || '—'} |`
    );
  }
  lines.push('');
}
if (hasUwp) {
  lines.push('## Arbeitszeitperioden (`user_work_periods`)');
  lines.push('');
  lines.push('| ID | Name | Perioden | Zeitraeume |');
  lines.push('|---|---|---|---|');
  for (const u of users) {
    const ps = u.workPeriods ?? [];
    lines.push(
      `| ${u.id} | ${u.firstName} ${u.lastName} | ${ps.length} | ${ps.map((p) => `${p.validFrom}→${p.validTo ?? 'offen'} (${p.weeklyHours}h${p.deletedAt ? ', geloescht' : ''})`).join('; ') || '—'} |`
    );
  }
  lines.push('');
} else {
  lines.push('## Arbeitszeitperioden (`user_work_periods`)');
  lines.push('');
  lines.push('Tabelle in dieser Datenbank **nicht vorhanden** (Migration 008 noch nicht angewendet).');
  lines.push('');
}

writeFileSync(`${outBase}.md`, `${lines.join('\n')}\n`, 'utf-8');

console.log(`Ist-Stand erhoben: ${users.length} Nutzer, ${deleted.length} davon soft-geloescht.`);
console.log(`JSON: ${jsonPath}`);
console.log(`Tabelle: ${outBase}.md`);
console.log(`SHA-256 Nutzdatenkern: ${payloadHash}`);
console.log(`SHA-256 Datei:         ${fileHash}`);
console.log(`integrity_check: ${JSON.stringify(integrity)}`);
console.log(`foreign_key_check: ${JSON.stringify(foreignKeys)}`);
