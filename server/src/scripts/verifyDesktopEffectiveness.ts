/**
 * CLI: Erhebt erneut die drei Messzahlen aus `11-DESKTOP-DISPOSITION.md`, Abschnitt
 * "Begründung 2: Wirksamkeitsfenster" (Plan 12-08, Task 3).
 *
 * WARUM DIESES WERKZEUG EXISTIERT:
 * `11-DESKTOP-DISPOSITION.md` hat den WR-12-Nachzug ausdrücklich an Phase 12 übergeben und
 * dabei vorausgesagt, dass ab Phase 12 mindestens eine der drei Messzahlen aufhört, null zu
 * sein — das ist der Zweck von Phase 12 (eine zweite Arbeitszeitperiode wird erstmals über
 * eine echte UI-Aktion möglich). Dieses Werkzeug erhebt genau dieselben drei Zahlen erneut,
 * mit derselben Abfrageform wie in der Disposition wörtlich dokumentiert, damit die Aussage
 * "Begründung 2 trägt nicht mehr" gemessen, nicht behauptet wird.
 *
 * REIN LESEND: kein INSERT, kein UPDATE, kein DELETE, kein `.run(` in dieser Datei. Öffnet die
 * Datenbank mit `readonly: true` UND setzt zusätzlich `PRAGMA query_only = ON` — doppelte
 * Absicherung, Muster aus `verifyPeriodNullEffect.ts`.
 *
 * PRODUKTIONSSCHUTZ (Muster aus `verifyPeriodNullEffect.ts`/`applyMigrationsToCopy.ts`):
 *   1. Ausschließlich importsichere Module am Kopf: `fs`, `path`, `better-sqlite3` (öffnet
 *      keine Datei beim Import des Pakets — erst bei `new Database(...)`),
 *      `./productionGuard.js`, `../config/database.js` (löst nur Strings auf).
 *   2. `assertNotProduction()` — synchron, vor jedem `new Database(...)`.
 *   3. Erst danach wird die Datenbank tatsächlich geöffnet.
 * DATABASE_PATH ist Pflicht, kein stiller Rückfall (`.claude/CLAUDE.md`, Database Rules).
 *
 * UNVERSEHRTHEITSNACHWEIS: Dateigröße und Änderungszeitstempel der geöffneten Datei werden
 * vor UND nach der Messung ausgegeben — bei einem rein lesenden Werkzeug müssen beide Werte
 * identisch sein.
 *
 * KEIN `process.exit()` (WR-12, Code-Review Phase 12): `process.stdout` ist beim Umleiten in
 * eine Datei oder Pipe gepuffert und asynchron. `process.exit()` beendet den Prozess, ohne
 * den Puffer zu leeren — bei genau dem Werkzeug, dessen Ausgabe als Messnachweis in eine
 * Datei geschrieben werden soll. Stattdessen wird `process.exitCode` gesetzt und
 * zurückgekehrt; Node beendet sich danach von selbst und leert den Puffer vorher.
 */

import { existsSync, statSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';
// WR-11: importsicher — dieses Modul importiert ausschließlich einen Typ und öffnet keine
// Datei. Es liefert die EINE Kanonisierung, die auch die Token-Signatur benutzt.
import { canonicalizeWorkSchedule, isStoredWorkSchedule } from '../utils/workSchedule.js';

interface MultiPeriodRow {
  userId: number;
  c: number;
}

interface DriftRow {
  userId: number;
  usersWeeklyHours: number;
  usersWorkSchedule: string | null;
  periodWeeklyHours: number;
  periodWorkSchedule: string | null;
}

interface NoOpenRow {
  id: number;
}

/** Berichtsausgabe ueber `process.stdout.write` statt einer Konsolen-Debugausgabe (Vorgabe des Plans). */
function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

/**
 * WR-11: Vergleichsform eines gespeicherten Tagesplans. Der Driftvergleich verglich vorher
 * ROHE JSON-Zeichenketten — zwei inhaltsgleiche Tagesplaene mit unterschiedlicher
 * Schluesselreihenfolge oder Formatierung wurden dadurch als Drift gezaehlt. Ein Text, der
 * kein auswertbarer Tagesplan ist, wird bewusst unveraendert (aber getrimmt) verglichen:
 * dann ist der Rohtext die einzige verfuegbare Information.
 */
function comparableWorkSchedule(raw: string | null): string {
  if (raw === null || raw.trim() === '') {
    return 'null';
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return `unparsierbar:${raw.trim()}`;
  }
  if (parsed === null) {
    return 'null';
  }
  if (!isStoredWorkSchedule(parsed)) {
    return `kein-tagesplan:${JSON.stringify(parsed)}`;
  }
  return canonicalizeWorkSchedule(parsed);
}

function main(): void {
  // DATABASE_PATH ist Pflicht — kein Rückfall auf getDatabasePath()s interne Standardwahl
  // (`.claude/CLAUDE.md`, Database Rules: ohne DATABASE_PATH entsteht sonst eine leere DB).
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
    console.error('  Setze DATABASE_PATH=<pfad-zu-einer-arbeitskopie> explizit.');
    console.error('  Nutzung: DATABASE_PATH=./database/12-08-wirksamkeit.db npx tsx src/scripts/verifyDesktopEffectiveness.ts');
    process.exitCode = 2;
    return;
  }

  // Guard VOR dem Öffnen der Datenbank.
  assertNotProduction();

  const resolvedPath = path.resolve(getDatabasePath());

  if (!existsSync(resolvedPath)) {
    console.error(`FEHLER: Datenbankdatei existiert nicht: ${resolvedPath}`);
    process.exitCode = 2;
    return;
  }

  const statBefore = statSync(resolvedPath);

  print('=== verifyDesktopEffectiveness: Wirksamkeitsfenster nach Phase 12 ===');
  print(`Aufgelöster Datenbankpfad: ${resolvedPath}`);
  print(`Dateigröße (vor der Messung): ${statBefore.size} Bytes`);
  print(`Zeitstempel (vor der Messung): ${statBefore.mtime.toISOString()}`);
  print('');

  // readonly: true PLUS PRAGMA query_only = ON — doppelte Absicherung (T-12-41).
  const db = new Database(resolvedPath, { readonly: true });
  db.pragma('query_only = ON');

  // 1. Nutzer mit mehr als einer Periode.
  const multiPeriod = db
    .prepare(
      `SELECT userId, COUNT(*) c FROM user_work_periods GROUP BY userId HAVING COUNT(*) > 1`
    )
    .all() as MultiPeriodRow[];
  print(`1) Nutzer mit >1 Periode: ${multiPeriod.length} ${JSON.stringify(multiPeriod.map((r) => r.userId))}`);

  // 2. Drift zwischen users.weeklyHours/workSchedule und der offenen Periode.
  //    WR-11: `AND u.deletedAt IS NULL` — soft-geloeschte Mitarbeiter sind keine Drift.
  const drift = db
    .prepare(
      `SELECT u.id as userId, u.weeklyHours as usersWeeklyHours, u.workSchedule as usersWorkSchedule,
              p.weeklyHours as periodWeeklyHours, p.workSchedule as periodWorkSchedule
       FROM users u
       JOIN user_work_periods p ON p.userId = u.id AND p.validTo IS NULL
       WHERE u.deletedAt IS NULL`
    )
    .all() as DriftRow[];
  let driftCount = 0;
  const driftIds: number[] = [];
  for (const row of drift) {
    // WR-11: kanonisierter Vergleich statt Rohtext-Vergleich.
    const wsA = comparableWorkSchedule(row.usersWorkSchedule);
    const wsB = comparableWorkSchedule(row.periodWorkSchedule);
    if (row.usersWeeklyHours !== row.periodWeeklyHours || wsA !== wsB) {
      driftCount++;
      driftIds.push(row.userId);
    }
  }
  print(`2) Drift-Zahl: ${driftCount} userIds: ${JSON.stringify(driftIds)}`);

  // 3. Nutzer ohne offene Periode.
  //    WR-11: `AND u.deletedAt IS NULL` — ein soft-geloeschter Mitarbeiter hat typischerweise
  //    keine offene Periode mehr und erschien dadurch dauerhaft in dieser Kennzahl. Die Zahl
  //    konnte strukturell nie 0 werden, obwohl die Ergebnisaussage unten genau darauf aufbaut.
  const noOpen = db
    .prepare(
      `SELECT u.id FROM users u
       WHERE u.deletedAt IS NULL
         AND NOT EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = u.id AND p.validTo IS NULL)`
    )
    .all() as NoOpenRow[];
  print(`3) Nutzer ohne offene Periode: ${noOpen.length} ${JSON.stringify(noOpen.map((r) => r.id))}`);

  const totalUsers = (
    db.prepare('SELECT COUNT(*) c FROM users WHERE deletedAt IS NULL').get() as { c: number }
  ).c;
  const totalPeriods = (db.prepare('SELECT COUNT(*) c FROM user_work_periods').get() as { c: number }).c;
  print(`Gesamtzahl users (ohne soft-geloeschte): ${totalUsers}`);
  print(`Gesamtzahl user_work_periods: ${totalPeriods}`);

  db.close();

  const statAfter = statSync(resolvedPath);
  print('');
  print('=== Unversehrtheitsnachweis ===');
  print(`Dateigröße (nach der Messung): ${statAfter.size} Bytes`);
  print(`Zeitstempel (nach der Messung): ${statAfter.mtime.toISOString()}`);
  const unchanged = statBefore.size === statAfter.size && statBefore.mtimeMs === statAfter.mtimeMs;
  print(`Unverändert: ${unchanged ? 'ja' : 'NEIN — Werkzeug hat unerwartet geschrieben'}`);

  if (!unchanged) {
    console.error('FEHLER: Datei wurde durch dieses rein lesende Werkzeug verändert.');
    process.exitCode = 1;
    return;
  }

  print('');
  const anyNonZero = multiPeriod.length > 0 || driftCount > 0 || noOpen.length > 0;
  print(
    multiPeriod.length > 0
      ? 'ERGEBNIS: Zahl 1 (Nutzer mit >1 Periode) ist groesser als 0 — Begruendung 2 der Disposition traegt nicht mehr.'
      : anyNonZero
        ? 'ERGEBNIS: Zahl 1 (Nutzer mit >1 Periode) ist weiterhin 0; mindestens eine der anderen beiden Zahlen ist nicht 0 (siehe oben) — kein Aussagewert fuer Begruendung 2, die ausschliesslich an Zahl 1 haengt.'
        : 'ERGEBNIS: Alle drei Zahlen sind 0 — Begruendung 2 der Disposition traegt in dieser Arbeitskopie noch.'
  );
}

main();
