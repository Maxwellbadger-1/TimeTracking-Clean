/**
 * CLI: Vergleicht zwei mit `14-ist-stand-report.mjs` erhobene Ist-Stände Feld für Feld und
 * meldet JEDE Wertdifferenz namentlich (Zusatzauflage zu Plan 14-08).
 *
 * ZUSICHERUNG, DIE DIESES WERKZEUG PRÜFT:
 * „An den Stundenständen darf sich nichts ändern. Es darf nichts verloren gehen."
 *
 * WAS ALS ERWARTETE STRUKTURÄNDERUNG GILT — UND WARUM GENAU NUR DIESE ZWEI:
 * Die Migrationen 008–015 sind Schemaänderungen. Zwei Dinge dürfen sich dadurch ändern,
 * beide werden ausdrücklich benannt und im Bericht ausgewiesen statt stillschweigend
 * unterdrückt:
 *   1. `migrations` wächst um genau die acht erwarteten Namen (008–015).
 *   2. `user_work_periods` geht von „Tabelle nicht vorhanden" auf `COUNT(*) FROM users`
 *      (Migration 009, REQ-21).
 * Jede andere Abweichung ist ein BLOCKER — insbesondere jede Zahl in `overtime_balance`,
 * `overtime_transactions`, `time_entries`, `vacation_balance` oder in den Stammdaten.
 *
 * EXITCODES:
 *   0 = keine unerwartete Differenz
 *   1 = mindestens eine unerwartete Differenz (BLOCKER)
 *   2 = Aufrufsfehler
 *
 * Nutzung:
 *   node scripts/14-ist-stand-vergleich.mjs --vorher=<pfad.json> --nachher=<pfad.json> \
 *     [--erwarte-migrationen=<name,name,...>] [--out=<pfad.md>]
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';

function usage(message) {
  if (message) console.error(`FEHLER: ${message}`);
  console.error('Nutzung:');
  console.error('  node scripts/14-ist-stand-vergleich.mjs --vorher=<a.json> --nachher=<b.json> [--erwarte-migrationen=<n,n>] [--out=<bericht.md>]');
  process.exit(2);
}

let vorherPath;
let nachherPath;
let erwarteteMigrationen = [];
let outPath;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--vorher=')) vorherPath = arg.slice('--vorher='.length);
  else if (arg.startsWith('--nachher=')) nachherPath = arg.slice('--nachher='.length);
  else if (arg.startsWith('--erwarte-migrationen='))
    erwarteteMigrationen = arg.slice('--erwarte-migrationen='.length).split(',').map((s) => s.trim()).filter(Boolean);
  else if (arg.startsWith('--out=')) outPath = arg.slice('--out='.length);
  else usage(`unbekanntes Argument: "${arg}"`);
}
if (!vorherPath) usage('--vorher fehlt.');
if (!nachherPath) usage('--nachher fehlt.');
if (!existsSync(vorherPath)) usage(`Datei existiert nicht: ${vorherPath}`);
if (!existsSync(nachherPath)) usage(`Datei existiert nicht: ${nachherPath}`);

const A = JSON.parse(readFileSync(vorherPath, 'utf-8'));
const B = JSON.parse(readFileSync(nachherPath, 'utf-8'));

/** @type {Array<{schwere:'BLOCKER'|'ERWARTET', bereich:string, gegenstand:string, vorher:string, nachher:string}>} */
const befunde = [];

const s = (v) => (v === null || v === undefined ? '(null)' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function vergleiche(bereich, gegenstand, a, b, schwere = 'BLOCKER') {
  if (s(a) !== s(b)) {
    befunde.push({ schwere, bereich, gegenstand, vorher: s(a), nachher: s(b) });
  }
}

// --- 1. Tabellenzählwerte -------------------------------------------------------------
for (const t of Object.keys({ ...A.tableCounts, ...B.tableCounts })) {
  const av = A.tableCounts[t];
  const bv = B.tableCounts[t];
  if (t === 'user_work_periods' && av === null && bv !== null) {
    // Erwartete Strukturänderung — aber nur, wenn der Wert exakt COUNT(*) FROM users ist.
    if (bv === B.tableCounts.users) {
      befunde.push({
        schwere: 'ERWARTET',
        bereich: 'Tabellenzählwerte',
        gegenstand: 'user_work_periods (Migration 009, REQ-21)',
        vorher: 'Tabelle nicht vorhanden',
        nachher: `${bv} (= COUNT(*) FROM users = ${B.tableCounts.users})`,
      });
    } else {
      befunde.push({
        schwere: 'BLOCKER',
        bereich: 'Tabellenzählwerte',
        gegenstand: 'user_work_periods stimmt NICHT mit COUNT(*) FROM users überein',
        vorher: 'Tabelle nicht vorhanden',
        nachher: `${bv}, erwartet ${B.tableCounts.users}`,
      });
    }
    continue;
  }
  vergleiche('Tabellenzählwerte', t, av, bv);
}

// --- 2. Migrationsliste ---------------------------------------------------------------
const neueMigrationen = B.migrations.filter((m) => !A.migrations.includes(m));
const verloreneMigrationen = A.migrations.filter((m) => !B.migrations.includes(m));
for (const m of verloreneMigrationen) {
  befunde.push({ schwere: 'BLOCKER', bereich: 'Migrationen', gegenstand: `verschwunden: ${m}`, vorher: 'vorhanden', nachher: 'fehlt' });
}
if (erwarteteMigrationen.length > 0) {
  for (const m of neueMigrationen) {
    befunde.push({
      schwere: erwarteteMigrationen.includes(m) ? 'ERWARTET' : 'BLOCKER',
      bereich: 'Migrationen',
      gegenstand: `neu angewendet: ${m}`,
      vorher: 'nicht angewendet',
      nachher: 'angewendet',
    });
  }
  for (const m of erwarteteMigrationen) {
    if (!B.migrations.includes(m)) {
      befunde.push({ schwere: 'BLOCKER', bereich: 'Migrationen', gegenstand: `erwartet, aber NICHT angewendet: ${m}`, vorher: '—', nachher: 'fehlt' });
    }
  }
} else {
  for (const m of neueMigrationen) {
    befunde.push({ schwere: 'BLOCKER', bereich: 'Migrationen', gegenstand: `unerwartet neu: ${m}`, vorher: 'nicht angewendet', nachher: 'angewendet' });
  }
}

// --- 3. integrity_check / foreign_key_check -------------------------------------------
vergleiche('Unversehrtheit', 'integrity_check', A.integrityCheck, B.integrityCheck);
vergleiche('Unversehrtheit', 'foreign_key_check', A.foreignKeyCheck, B.foreignKeyCheck);

// --- 4. Nutzer, namentlich -------------------------------------------------------------
const aById = new Map(A.users.map((u) => [u.id, u]));
const bById = new Map(B.users.map((u) => [u.id, u]));

for (const [id, ua] of aById) {
  if (!bById.has(id)) {
    befunde.push({
      schwere: 'BLOCKER',
      bereich: 'Nutzerbestand',
      gegenstand: `Nutzer ${id} (${ua.firstName} ${ua.lastName}) VERSCHWUNDEN`,
      vorher: 'vorhanden',
      nachher: 'fehlt',
    });
  }
}
for (const [id, ub] of bById) {
  if (!aById.has(id)) {
    befunde.push({
      schwere: 'BLOCKER',
      bereich: 'Nutzerbestand',
      gegenstand: `Nutzer ${id} (${ub.firstName} ${ub.lastName}) NEU HINZUGEKOMMEN`,
      vorher: 'fehlt',
      nachher: 'vorhanden',
    });
  }
}

// Felder, die Feld für Feld gleich bleiben MÜSSEN. `workPeriods` bewusst ausgenommen —
// die Tabelle existiert vorher nicht; sie wird über den Zählwert oben geprüft.
const STAMMFELDER = [
  'firstName', 'lastName', 'username', 'role', 'department', 'position',
  'deletedAt', 'status', 'hireDate', 'endDate', 'weeklyHours', 'workSchedule',
  'vacationDaysPerYear',
];

for (const [id, ua] of aById) {
  const ub = bById.get(id);
  if (!ub) continue;
  const name = `${ua.firstName} ${ua.lastName}`;
  const bez = `Nutzer ${id} (${name})`;

  for (const f of STAMMFELDER) {
    vergleiche('Stammdaten', `${bez} · ${f}`, ua[f], ub[f]);
  }

  // Überstunden — Summen und jeder einzelne Monat
  for (const f of ['monthCount', 'sumTargetHours', 'sumActualHours', 'sumOvertime', 'sumCarryover']) {
    vergleiche('Stunden', `${bez} · overtime_balance.${f}`, ua.overtimeBalance[f], ub.overtimeBalance[f]);
  }
  const amonths = new Map(ua.overtimeBalance.months.map((m) => [m.month, m]));
  const bmonths = new Map(ub.overtimeBalance.months.map((m) => [m.month, m]));
  for (const [monat, ma] of amonths) {
    const mb = bmonths.get(monat);
    if (!mb) {
      befunde.push({ schwere: 'BLOCKER', bereich: 'Stunden', gegenstand: `${bez} · Monat ${monat} VERSCHWUNDEN`, vorher: s(ma), nachher: '(fehlt)' });
      continue;
    }
    for (const f of ['targetHours', 'actualHours', 'overtime', 'carryoverFromPreviousYear']) {
      vergleiche('Stunden', `${bez} · ${monat} · ${f}`, ma[f], mb[f]);
    }
  }
  for (const [monat, mb] of bmonths) {
    if (!amonths.has(monat)) {
      befunde.push({ schwere: 'BLOCKER', bereich: 'Stunden', gegenstand: `${bez} · Monat ${monat} NEU`, vorher: '(fehlt)', nachher: s(mb) });
    }
  }

  vergleiche('Stunden', `${bez} · overtime_transactions.count`, ua.overtimeTransactions.count, ub.overtimeTransactions.count);
  vergleiche('Stunden', `${bez} · overtime_transactions.sumHours`, ua.overtimeTransactions.sumHours, ub.overtimeTransactions.sumHours);
  for (const f of ['count', 'sumHours', 'minDate', 'maxDate']) {
    vergleiche('Zeiteinträge', `${bez} · time_entries.${f}`, ua.timeEntries[f], ub.timeEntries[f]);
  }
  vergleiche('Abwesenheiten', `${bez} · absence_requests.count`, ua.absenceRequests.count, ub.absenceRequests.count);

  // Urlaub — je Jahr
  const ayears = new Map(ua.vacationYears.map((v) => [v.year, v]));
  const byears = new Map(ub.vacationYears.map((v) => [v.year, v]));
  for (const [jahr, va] of ayears) {
    const vb = byears.get(jahr);
    if (!vb) {
      befunde.push({ schwere: 'BLOCKER', bereich: 'Urlaub', gegenstand: `${bez} · Jahr ${jahr} VERSCHWUNDEN`, vorher: s(va), nachher: '(fehlt)' });
      continue;
    }
    for (const f of ['entitlement', 'carryover', 'taken', 'remaining', 'transactionsCount', 'transactionsSumDays']) {
      vergleiche('Urlaub', `${bez} · ${jahr} · ${f}`, va[f], vb[f]);
    }
  }
  for (const [jahr, vb] of byears) {
    if (!ayears.has(jahr)) {
      befunde.push({ schwere: 'BLOCKER', bereich: 'Urlaub', gegenstand: `${bez} · Jahr ${jahr} NEU`, vorher: '(fehlt)', nachher: s(vb) });
    }
  }
}

// --- Ausgabe ----------------------------------------------------------------------------
const blocker = befunde.filter((b) => b.schwere === 'BLOCKER');
const erwartet = befunde.filter((b) => b.schwere === 'ERWARTET');

const lines = [];
lines.push('# Vergleich der Ist-Stände');
lines.push('');
lines.push(`**VORHER:** ${A.label}`);
lines.push(`  \`${vorherPath}\` — erhoben ${A.generatedAt}`);
lines.push('');
lines.push(`**NACHHER:** ${B.label}`);
lines.push(`  \`${nachherPath}\` — erhoben ${B.generatedAt}`);
lines.push('');
lines.push(`**Geprüfte Nutzer:** ${A.users.length} vorher / ${B.users.length} nachher (namentlich, soft-gelöschte eingeschlossen)`);
lines.push('');
lines.push(`## Ergebnis: ${blocker.length === 0 ? '**KEINE unerwartete Differenz**' : `**${blocker.length} BLOCKER**`}`);
lines.push('');
if (blocker.length === 0) {
  lines.push('Kein Stundenwert, kein Urlaubswert, kein Stammdatenfeld und kein Zählwert hat sich');
  lines.push('bewegt. Nichts ist verschwunden, nichts ist hinzugekommen.');
} else {
  lines.push('| Bereich | Gegenstand | vorher | nachher |');
  lines.push('|---|---|---|---|');
  for (const b of blocker) {
    lines.push(`| ${b.bereich} | ${b.gegenstand} | \`${b.vorher}\` | \`${b.nachher}\` |`);
  }
}
lines.push('');
lines.push(`## Ausdrücklich erwartete Strukturänderungen (${erwartet.length})`);
lines.push('');
if (erwartet.length === 0) {
  lines.push('Keine.');
} else {
  lines.push('| Bereich | Gegenstand | vorher | nachher |');
  lines.push('|---|---|---|---|');
  for (const b of erwartet) {
    lines.push(`| ${b.bereich} | ${b.gegenstand} | \`${b.vorher}\` | \`${b.nachher}\` |`);
  }
}
lines.push('');

const bericht = `${lines.join('\n')}\n`;
if (outPath) {
  writeFileSync(outPath, bericht, 'utf-8');
  console.log(`Bericht geschrieben: ${outPath}`);
}
console.log(bericht);

if (blocker.length > 0) {
  console.error(`ERGEBNIS: ${blocker.length} BLOCKER — nicht weiterarbeiten (Exit 1).`);
  process.exit(1);
}
console.log(`ERGEBNIS: keine unerwartete Differenz; ${erwartet.length} erwartete Strukturänderung(en) (Exit 0).`);
process.exit(0);
