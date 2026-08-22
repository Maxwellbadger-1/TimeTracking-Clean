# Phase 14: Absicherung und Auslieferung - Pattern Map

**Erhoben:** 2026-08-23
**Analysierte Dateien:** 10 (5 Testfälle REQ-32 + Zwei-Stufen-Skripte + Generalprobe-Runner + Doku-Artefakte + Release-Dateien)
**Analoga gefunden:** 10 / 10 (Phase 14 ist eine reine Absicherungs-/Auslieferungsphase — für jeden Artefakttyp existiert bereits ein wörtliches Vorbild aus Phase 6, 9, 10, 11, 12 oder 13)

**Wichtigster Befund vorab:** Ein Großteil der REQ-32-Testfälle **existiert bereits** als
`it(...)`-Block in `server/src/services/workPeriodChangeService.test.ts` und
`workPeriodDeletionService.test.ts` (aus Phase 12/13). Phase 14 muss sie nicht neu erfinden,
sondern (a) den einen echten Lückenfall ergänzen — **Erhöhung mit rückwirkendem Stichtag**
existiert nirgends, alle bisherigen Tests nutzen 40→20 (Reduzierung) — und (b) alle fünf Fälle
als geschlossene, benannte Nachweisliste für REQ-32 referenzieren/verlinken statt sie stillos
als Nebeneffekt anderer Pläne stehen zu lassen.

| REQ-32-Fall | Bereits vorhanden? | Fundstelle |
|---|---|---|
| Reduzierung (40→20), Stichtag in der Zukunft | ✅ ja | `workPeriodChangeService.test.ts:172` (REQ-28-Test) |
| Erhöhung, Stichtag rückwirkend | ❌ **fehlt** — nur Reduzierungsfälle rückwirkend vorhanden | `workPeriodChangeService.test.ts:224` ist die Vorlage, aber mit `weeklyHours: 20` (Reduzierung) |
| Stichtag mitten im Monat | ✅ ja | `workPeriodChangeService.test.ts:577` |
| Wechsel über einen Jahreswechsel | ✅ ja | `workPeriodChangeService.test.ts:670` |
| Periode löschen und neu rechnen | ✅ ja (Doppelzählungs-Nachweis, stärker als nötig) | `workPeriodDeletionService.test.ts:180-264` |

---

## File Classification

| Neue/geänderte Datei (Vorschlag) | Rolle | Datenfluss | Nächster Analog | Trefferqualität |
|---|---|---|---|---|
| `server/src/services/workPeriodChangeService.test.ts` (Ergänzung: 1 neuer `it`-Block „Erhöhung rückwirkend") | test | CRUD (Periode anlegen → Rebuild → Journalbuchung) | dieselbe Datei, `it(...)` bei Zeile 224 | exact (Copy-Paste-Analog in derselben Datei) |
| `server/src/scripts/runModelChangeProductionDryRun.ts` (Name Vorschlag) — Zwei-Stufen-Skript für den realen Umstellungsfall (D6) | utility/script | batch, request-response gegen DB | `server/src/scripts/correctPreHireVacationBalances2025.ts` (Plan 06-07) | exact |
| `server/src/scripts/runOvertimeBackfillProductionDryRun.ts` (Name Vorschlag) — Phase-9.1-Backfill, im selben Produktionsfenster | utility/script | batch, request-response gegen DB | `server/src/scripts/migrateOvertimeToTransactions.ts` | exact |
| `server/src/scripts/rehearsalRunner.ts` (Name Vorschlag) — Generalprobe: Kopie ziehen → migrieren → Vorher/Nachher-Snapshot → Diff | utility/script | batch | `server/src/scripts/applyMigrationsToCopy.ts` + `snapshotBalances.ts` (kombiniert) | exact |
| `.planning/phases/14-.../14-ROLLBACK-RUNBOOK.md` (Doku) | Dokumentation | — | `06-07-SUMMARY.md` Abschnitt „Rückgängig-Machbarkeit" | role-match |
| `.planning/phases/14-.../14-VORHER-NACHHER.md` (Doku, D5-Nachweis) | Dokumentation | — | `10-05-PLAN.md`/`snapshotBalances.ts`-Ausgabeformat | exact |
| `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json` (Versionssprung) | config | — | Plan 08-05 (`1.7.3 → 1.8.0`) | exact |
| `CHANGELOG.md`, `PROJECT_STATUS.md` (Update) | Dokumentation | — | Plan 08-05 | exact |
| ggf. `server/src/scripts/fix-overtime.ts` (WR-05-Härtung, wenn im selben Fenster mitgeplant) | utility/script | batch, cron | `migrateOvertimeToTransactions.ts` (Tages-Transaktion, Fehlerisolierung) | role-match |
| Generalprobe-Auswertung/Diff-Report (Teil des Rehearsal-Runners) | utility/transform | batch | `snapshotBalances.ts` Ausgabeformat (`*.users.json`) | exact |

---

## Pattern Assignments

### 1. Testfälle REQ-32 — Ergänzung „Erhöhung mit rückwirkendem Stichtag"

**Analog:** `server/src/services/workPeriodChangeService.test.ts`, Test bei Zeile 224
(„REQ-26: Ein rueckwirkender Stichtag rechnet ab seinem Datum neu…") — **identischer Aufbau**,
nur `weeklyHours: 20` → höherer Wert als der Ausgangszustand ersetzen, dann muss
`balanceDelta` **negativ** statt positiv geprüft werden (mehr Sollstunden rückwirkend →
Saldo sinkt, nicht steigt).

**Test-Setup/Fixtures (wörtlich zu übernehmen):**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import { applyWorkTimeChange, WorkTimeChangeValidationError } from './workPeriodChangeService.js';
import type { WorkTimeChangeInput } from '../types/index.js';

const USERNAME_PREFIX = 'test-12-05-';   // Phase 14: eigenes Präfix wählen, z.B. 'test-14-01-'
const createdUserIds: number[] = [];
let adminId: number;

beforeAll(() => {
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
  // ... Test-Admin anlegen (siehe workPeriodChangeService.test.ts:44-59)
});

afterAll(() => {
  db.prepare('DELETE FROM audit_log WHERE userId = ?').run(adminId);
  db.prepare('DELETE FROM users WHERE id = ?').run(adminId);
});

function createEmployee(suffix: string, weeklyHours: number, hireDate: string): number { /* ... siehe :74-85 */ }
function cleanupEmployee(userId: number): void { /* CASCADE + explizites Aufräumen, siehe :90-97 */ }
```

**Kern-Testkörper (wörtliche Vorlage, Analog für „Erhöhung rückwirkend"):**
`server/src/services/workPeriodChangeService.test.ts:224-282`
```typescript
it('REQ-26: Ein rueckwirkender Stichtag rechnet ab seinem Datum neu und laesst jede Buchung davor unveraendert', () => {
  const userId = createEmployee('rueckwirkung', 40, '2020-01-01');
  try {
    insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

    const validFrom = firstOfMonthOffset(today, -2);
    const priorMonth = firstOfMonthOffset(today, -3);

    insertWeekdayTimeEntries(userId, priorMonth, lastOfMonth(priorMonth), 8);
    rebuildOvertimeTransactionsForMonth(userId, priorMonth.slice(0, 7));
    insertWeekdayTimeEntries(userId, validFrom, today, 8);

    const before = db.prepare(
      `SELECT id, date, type, hours FROM overtime_transactions
       WHERE userId = ? AND date < ? ORDER BY date, id`
    ).all(userId, validFrom);
    expect(before.length).toBeGreaterThan(0);

    const input: WorkTimeChangeInput = {
      userId, validFrom, weeklyHours: 20, workSchedule: null,   // <- Phase 14: hier höheren Wert als 40 einsetzen (z.B. 40 → 40, Basis 20 → 40 als Erhöhung)
      reason: 'Reduzierung der Wochenstunden rueckwirkend zum Stichtag',
    };
    const outcome = applyWorkTimeChange(input, { dryRun: false, createdBy: adminId });

    const after = db.prepare(/* gleiche Query wie oben */).all(userId, validFrom);
    expect(after).toEqual(before);                    // Vergangenheit unangetastet — REQ-26 Kernaussage
    expect(outcome.preview.balanceDelta).toBeGreaterThan(0);  // <- bei Erhöhung: toBeLessThan(0)

    const modelChangeRows = db.prepare(
      `SELECT date, referenceType, referenceId FROM overtime_transactions
       WHERE userId = ? AND type = 'model_change'`
    ).all(userId) as Array<{ date: string; referenceType: string; referenceId: number }>;
    expect(modelChangeRows).toHaveLength(1);
    expect(modelChangeRows[0].date).toBe(validFrom);
    expect(modelChangeRows[0].referenceType).toBe('work_period');
    expect(modelChangeRows[0].referenceId).toBe(outcome.period!.id);
  } finally {
    cleanupEmployee(userId);
  }
});
```

**Basissetup für Erhöhung (Ausgangswert muss NIEDRIGER als der neue Wert sein):**
`createEmployee('erhoehung-rueckwirkend', 20, hireDate)` +
`insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours: 20, ... })`, dann
`applyWorkTimeChange({ ..., weeklyHours: 40, ... })` — Vorzeichen von `balanceDelta` dreht
sich um (mehr Soll rückwirkend → Saldo sinkt).

**Mid-Month-Analog** (bereits vorhanden, referenzieren statt duplizieren):
`workPeriodChangeService.test.ts:577-619` — prüft `outcome.preview.midMonthEffective === true`
und dass der Tag vor dem Stichtag das alte, der Tag ab dem Stichtag das neue Tagessoll trägt.

**Jahreswechsel-Analog** (bereits vorhanden):
`workPeriodChangeService.test.ts:670-693` — `validFrom = ${todayYear - 1}-12-01`, prüft
`years.size >= 2` über `outcome.preview.affectedMonths`.

**Löschen-und-neu-rechnen-Analog** (bereits vorhanden, stärkster Nachweis im Projekt):
`server/src/services/workPeriodDeletionService.test.ts:180-264` — der
„Doppelzählungs-Nachweis": Umstellung eintragen → `deleteWorkPeriod()` → der **tatsächlich
berechnete** Saldo (`getOvertimeBalance()`, nicht die Journalsumme!) ist wieder auf 1/60 h
genau der Ausgangswert. Vier benannte Zusicherungen A–D (Saldo, Journalsumme, Anzeigepfad,
Zeilenzahl/Gegenbuchung).

---

### 2. Zwei-Stufen-Skript gegen Produktion (D3, Plan 06-07-Muster)

**Analog:** `server/src/scripts/correctPreHireVacationBalances2025.ts` (vollständig, 109 Zeilen) —
das wörtliche Vorbild aus CONTEXT.md D3 ("Dasselbe Muster wie in Plan 06-07").

**Kopfkommentar-Muster (Aufrufform, DATABASE_PATH-Pflicht):**
```typescript
/**
 *   npx tsx src/scripts/<name>.ts            → Trockenlauf
 *   npx tsx src/scripts/<name>.ts --apply    → schreibt
 *
 * Vorgeschriebene Aufrufform gegen die Produktionsdatenbank (.claude/CLAUDE.md,
 * „Database Rules" — ohne DATABASE_PATH legt getDatabasePath() eine NEUE, LEERE Datei an):
 *
 *   DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
 *     npx tsx src/scripts/<name>.ts [--apply]
 */
```

**CLI-Kern (Trockenlauf-Default, `--apply`-Schalter, allererste Zeile = aufgelöster Pfad):**
```typescript
import { db } from '../database/connection.js';
import databaseConfig from '../config/database.js';

const CANDIDATES = [ /* hartkodiert, vom Anwender geprüft — D6: der reale Fall wird bestätigt, nicht erfunden */ ];
const APPLY = process.argv.includes('--apply');

console.log('Datenbank:', databaseConfig.path);   // Lehre aus zwei gescheiterten Phase-8-Deployments
console.log(APPLY ? '### MODUS: SCHREIBEN ###\n' : '### TROCKENLAUF — es wird nichts geschrieben ###\n');

const plan = buildPlan(CANDIDATES);   // reine Leselogik, aus dem CLI-Skript ausgelagert
for (const entry of plan) {
  if (entry.eligible) {
    console.log(`--- ${entry.userName} --- eligible: true`);
  } else {
    console.log(`--- userId ${entry.userId} --- eligible: false — Grund: ${entry.reason}`);
  }
}

const eligibleEntries = plan.filter((e) => e.eligible);
if (eligibleEntries.length === 0) { console.log('Kein Kandidat eligible.'); process.exit(0); }
if (!APPLY) { console.log('Trockenlauf beendet. Mit --apply ausführen.'); process.exit(0); }

const write = db.transaction(() => {
  for (const entry of eligibleEntries) {
    const before = /* Saldo vorher lesen */;
    applyCorrection(entry);
    const after = /* Saldo nachher lesen */;
    console.log(`${entry.userName}: ${before} → ${after}`);
  }
});
write();

console.log('integrity_check:', JSON.stringify(db.pragma('integrity_check')));
```

**Produktionsschutz-Variante (striktere Reihenfolge, wenn kein `db`-Modul statisch importiert
werden darf — nötig, wenn das Skript auch gegen eine lokale Kopie testbar sein soll ohne
Produktionsgefahr):**
Analog: `server/src/scripts/snapshotBalances.ts:44-62` (Kopfkommentar „PRODUKTIONSSCHUTZ UND
REIHENFOLGE") + `server/src/scripts/productionGuard.ts` (vollständig, 63 Zeilen):
```typescript
import path from 'path';
import { getDatabasePath, getProductionDatabasePath } from '../config/database.js';

export function assertNotProduction(explicitPath?: string): void {
  const resolvedPath = path.resolve(explicitPath ?? getDatabasePath());
  const productionPath = path.resolve(getProductionDatabasePath());
  const nodeEnv = process.env.NODE_ENV;
  const looksLikeProduction =
    resolvedPath === productionPath ||
    nodeEnv === 'production' ||
    resolvedPath.toLowerCase().includes('production');
  if (looksLikeProduction) {
    console.error('FEHLER: Produktionsschreibzugriff verweigert.');
    process.exit(2);
  }
}
```
Reihenfolge zwingend: (1) nur importsichere Module am Kopf (`fs`, `path`,
`./productionGuard.js`, `../config/database.js` — löst nur Strings auf), (2) Argumentauswertung,
(3) `assertNotProduction()` synchron, (4) erst danach `await import('../database/connection.js')`
und alle DB-berührenden Services **innerhalb** von `main()`. Dieses Muster ist genau umgekehrt
zu Punkt 1 gedacht: Für ein Skript, das am Ende bewusst GEGEN Produktion laufen soll (der
Produktionslauf selbst, D2 `autonomous: false`), wird `assertNotProduction()` NICHT verwendet
— stattdessen `--apply` + explizites `DATABASE_PATH` als einzige Sicherung, wie in
`correctPreHireVacationBalances2025.ts`. Für alle Trockenlauf-/Generalprobe-Skripte GEGEN
EINE KOPIE gilt weiterhin `assertNotProduction()`.

**Wichtiger Fallstrick aus `migrateOvertimeToTransactions.ts:14-23`:** Transaktional ist der
Tag/die Einzeleinheit, nicht der ganze Lauf. Bei Abbruch mitten im Lauf bleiben bereits
verarbeitete Einheiten geschrieben — das muss im Skript ausgesprochen und beim Abbruch
ausgegeben werden ("X von Y verarbeitet").

---

### 3. Migration gegen eine Kopie fahren (Generalprobe-Baustein)

**Analog:** `server/src/scripts/applyMigrationsToCopy.ts` (vollständig, 226 Zeilen).

**Kern (Pflichtargument `--db`, kein Rückfall, Vorher/Nachher-Metriken, `integrity_check`):**
```typescript
import { existsSync, statSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { assertNotProduction } from './productionGuard.js';
import { runMigrations } from '../database/migrationRunner.js';

function parseArgs(): { dbPath: string; expectMigration?: string } {
  // --db=<pfad> ist Pflicht, sonst printUsageAndExit() mit Exit 2
}

async function main(): Promise<void> {
  const { dbPath, expectMigration } = parseArgs();
  const resolvedPath = path.resolve(dbPath);
  assertNotProduction(resolvedPath);                 // Guard MIT explizitem Pfad
  if (!existsSync(resolvedPath)) { /* Exit 2, keine leere Datei anlegen */ }

  const db = new Database(resolvedPath);
  db.pragma('foreign_keys = ON');
  const migrationsBefore = getAppliedMigrations(db);

  await runMigrations(db);                            // derselbe migrationRunner wie im Server

  const migrationsAfter = getAppliedMigrations(db);
  const newlyApplied = migrationsAfter.filter((n) => !migrationsBefore.includes(n));
  const integrityRows = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
  const integrityOk = integrityRows.length === 1 && integrityRows[0].integrity_check === 'ok';
  const foreignKeyIssues = db.pragma('foreign_key_check') as unknown[];

  let exitCode = 0;
  if (!integrityOk || foreignKeyIssues.length > 0) { exitCode = 1; }
  if (expectMigration && !migrationsAfter.includes(expectMigration)) { exitCode = 1; }

  db.close();
  process.exit(exitCode);
}
```
Aufruf: `npm run migrate:copy -- --db=<pfad-zu-einer-kopie> [--expect-migration=<name>]`

---

### 4. Vorher/Nachher-Saldenvergleich (D5, das maschinelle Vergleichswerkzeug)

**Analog:** `server/src/scripts/snapshotBalances.ts` (vollständig, 466 Zeilen) — laut D5
wörtlich das Werkzeug, das für den Produktionslauf erneut gefahren wird.

**CLI-Interface:**
```
npm run snapshot:balances -- --all --asOf=<YYYY-MM-DD> --json=<pfad>
npm run snapshot:balances -- --user=<id> --asOf=<YYYY-MM-DD> --json=<pfad>
npm run snapshot:balances -- --users=<id,id,...> --asOf=<YYYY-MM-DD> --json=<pfad>
```
`--asOf` ist Pflicht (kein Rückfall auf heute), `DATABASE_PATH` ist Pflicht (kein Rückfall auf
`development.db`, geprüft **vor** `assertNotProduction()`).

**Ausgabeformat (zwei Dateien: vollständig + Vergleichsdatei):**
```typescript
const output = { generatedAt: new Date().toISOString(), databasePath: resolvedPath, asOf, toolVersion, users };
writeFileSync(jsonPath, JSON.stringify(output, null, 2) + '\n');
const usersOnlyPath = deriveUsersOnlyPath(jsonPath);   // '<pfad>.users.json'
writeFileSync(usersOnlyPath, JSON.stringify(users, null, 2) + '\n');
```
`deriveUsersOnlyPath()` (Zeile 173-178): hängt `.users.json` an, damit ein reiner
Byte-/Diff-Vergleich (`diff before.users.json after.users.json`) exakt die
Nutzerdaten vergleicht, ohne `generatedAt`/`databasePath`-Rauschen. **Das ist der D5-Diff:**
Vorher-Snapshot vor der Migration/dem Produktionslauf, Nachher-Snapshot danach, `diff` der
beiden `*.users.json`-Dateien — erwartete Differenzmenge ist exakt die Menge der Nutzer mit
echtem Modellwechsel, jeder weitere Name ist ein Blocker.

**Nur nebenwirkungsfreie Lesepfade verwenden** (Kopfkommentar Zeile 19-24): ausschließlich
`unifiedOvertimeService.calculatePeriodOvertime()`, kein Lesepfad, der beim Lesen selbst
schreibt.

**Bekannte erwartete Differenzen aus CONTEXT.md** (für den Diff-Report vorab dokumentieren,
damit sie nicht als Blocker fehlinterpretiert werden): User 30 „Test Urlaub", User 31 „UAT",
Antrag 73 (storniert) — plus die Nutzer des echten Umstellungsfalls (D6, noch als Platzhalter).

---

### 5. Rehearsal-Runner (Generalprobe, D1) — Komposition der obigen Bausteine

Kein eigenständiger neuer Pattern-Typ nötig: die Generalprobe ist die Verkettung von
`applyMigrationsToCopy.ts` (Migration auf Kopie) + `snapshotBalances.ts` (vorher) +
das Produktionslauf-Zwei-Stufen-Skript **gegen dieselbe Kopie statt Produktion** (D3) +
`snapshotBalances.ts` (nachher) + Diff. Kein neues Skript-Skelett, sondern eine
Dokumentation der Reihenfolge (D1: „Testabdeckung grün → Generalprobe … → Backup →
Deployment → Produktionslauf → Verifikation → Release. Jeder Schritt ein eigener
Plan-Abschnitt mit eigenem Nachweis.").

**Kopie ziehen:** `npm run sync-dev-db` (laut `.claude/CLAUDE.md` und CONTEXT.md „Existing
Code Insights") zieht die Produktionskopie nach lokal — Ausgangspunkt für die Generalprobe.

**Backup-Namensmuster (aus 06-07-SUMMARY.md, Zeile 85, „Phase 6"):**
```
/home/ubuntu/databases/backups/production.PRE-<plan>_<YYYYMMDD>_<HHMMSS>.db
```
Erzeugt per `VACUUM INTO`, **nicht** per einfachem `cp` — die WAL-Datei kann zum
Kopierzeitpunkt Größe > 0 haben und ein Datei-Kopiervorgang verliert dann die jüngsten,
noch nicht in die Haupt-DB geschriebenen Transaktionen (06-07-SUMMARY.md, Zeile 85).

---

### 6. Migration registrieren (Muster für migrationRunner-Integration, falls Phase 14 eine
eigene Migration braucht — z. B. für Backfill-Tracking)

**Analog:** `server/src/database/migrationRunner.ts` (vollständig, 215 Zeilen) — lädt
`server/src/database/migrations/*.ts` alphabetisch, wendet jede noch nicht in der
`migrations`-Tabelle stehende Datei an. Zwei Pfade: synchron (Regelfall,
`db.transaction()`) und asynchron (nur Migration 001, keine Atomaritätszusage).

**Migrations-Datei-Skelett (Analog: `015_unique_reversal_of_index.ts`, vollständig 107 Zeilen —
das neueste Muster mit Selbstverifikation):**
```typescript
import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

export default {
  up(db: Database.Database): void {
    logger.info('🚀 Migration 0xx: ...');

    // 1. Bestandsprüfung VOR dem Umbau (Selbstverifikations-Vorbedingung)
    const problems = db.prepare(`SELECT ... HAVING COUNT(*) > 1`).all();
    if (problems.length > 0) {
      throw new Error('Migration abgebrochen: ... Migration wird NICHT als angewendet markiert.');
    }

    // 2. Umbau
    db.prepare(`...`).run();

    // 3. Selbstverifikation — schlägt sie fehl, wird geworfen, Migration gilt als NICHT
    //    angewendet (migrationRunner.ts:106-129: erst up(), dann recordMigration()).
    const check = db.prepare(`SELECT ... `).get();
    if (!check) {
      throw new Error('Migration unvollständig: ... Migration wird NICHT als angewendet markiert.');
    }
    logger.info('✅ Migration 0xx verified');
  },
};
```
**Registrierung:** keine explizite Registrierungsdatei — `loadMigrations()`
(`migrationRunner.ts:178-215`) liest alphabetisch alle `*.ts`/`*.js` unter
`server/src/database/migrations/`. Neue Migration = neue Datei mit fortlaufender Nummer,
`export default { up(db) {...} }`. **Parity-Pflicht** (siehe Migration 011, Kopfkommentar
Zeile 25-27): `server/src/database/schema.ts` (CREATE-TABLE-Statements für Neuinstallationen)
muss denselben Constraint/dieselbe Spalte parallel bekommen — geprüft durch
`server/src/database/schemaMigrationParity.test.ts`.

---

### 7. Desktop `check:rules` (Phase 13, wiederverwendbar für Phase 14)

**Fundort:** `desktop/package.json:22-23`
```json
"check:rules:types": "tsc -p tsconfig.check.json --noEmit",
"check:rules": "npm run check:rules:types && tsx src/components/ui/confirmDialogProps.check.ts && tsx src/components/worktime/overtimeTransactionFormat.check.ts && tsx src/components/worktime/workTimePeriodEditRules.check.ts && tsx src/components/worktime/workTimePeriodDeleteRules.check.ts"
```
**Analog für Struktur eines `*.check.ts`-Skripts:**
`desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts` (Kopf, Zeilen 1-31):
```typescript
/**
 * `vitest` ist im Desktop projektweit nicht lauffähig (@babel/runtime fehlt).
 * Muster: ein `npx tsx`-Prüfskript mit `node:assert`.
 * Ausführung: cd desktop && npm run check:rules
 */
import assert from 'node:assert/strict';
import { /* zu prüfende Exporte */ } from './xyzRules';

let testCount = 0;
function test(name: string, fn: () => void): void {
  fn();
  testCount++;
  console.log(`PASS: ${name}`);
}

test('Beschreibung', () => {
  assert.equal(actual, expected);
});
```
**Warum relevant für Phase 14:** D7 verlangt `tsc --noEmit` grün für Desktop UND Server. Für
den Desktop läuft die Prüfung NICHT über `vitest` (nicht lauffähig, siehe env-Hinweis), sondern
über `npm run check:rules` (`tsc -p tsconfig.check.json --noEmit` + die vier `*.check.ts`-Läufe).
Release-Checkliste in `.claude/CLAUDE.md` nennt nur `npx tsc --noEmit` — Phase 14 sollte
zusätzlich `check:rules` als bereits etabliertes Pflicht-Gate referenzieren, wenn
`workTimePeriodEditRules.ts`/`workTimePeriodDeleteRules.ts` im Scope sind.

---

### 8. Release-Prozedur (D7, Plan 08-05-Muster)

**Analog:** `.planning/milestones/v2.0-phases/08-kontoauszug-f-r-mitarbeiter-und-admin/08-05-PLAN.md`
+ `08-05-SUMMARY.md` (vollständig gelesen).

**Ablauf wörtlich (aus `.claude/CLAUDE.md` „Release (Desktop App)", verifiziert durch 08-05):**
```bash
# Pre-Checks (PFLICHT!)
cd desktop && npx tsc --noEmit     # MUSS ohne Fehler laufen
git status                          # MUSS clean sein

# Version Bump (3 Files!) — aktueller Stand vor Phase 14: 1.8.0 in allen dreien
desktop/package.json                → "version": "1.X.Y"
desktop/src-tauri/Cargo.toml        → version = "1.X.Y"
desktop/src-tauri/tauri.conf.json   → "version": "1.X.Y"

git commit -m "chore: Bump version to v1.X.Y"
git push origin main
git tag v1.X.Y && git push origin v1.X.Y
```

**Release-Workflow überwachen (Analog `gh`-Befehle, wörtlich aus 08-05-PLAN.md Zeilen
142-208):**
```bash
gh run list --workflow="release.yml" --limit 1
gh run watch <run-id>
gh run view <run-id> --json jobs --jq '[.jobs[].conclusion] | unique'   # erwartet ["success"]

gh release view v1.X.Y --json isDraft,name,tagName
gh release view v1.X.Y --json assets --jq '.assets[].name'
gh release download v1.X.Y -p latest.json -D <tmp-verzeichnis>
```

**`latest.json`-Pflichtprüfung (die vier Plattformschlüssel, wörtlich aus 08-05-PLAN.md
Zeilen 198-204):**
```bash
gh release view v1.X.Y --json assets --jq '[.assets[].name] | map(select(test("\\.dmg$"))) | length'       # >= 1
gh release view v1.X.Y --json assets --jq '[.assets[].name] | map(select(test("\\.(exe|msi)$"))) | length'  # >= 1
gh release view v1.X.Y --json assets --jq '[.assets[].name] | map(select(test("\\.(AppImage|deb)$"))) | length'  # >= 2
gh release view v1.X.Y --json assets --jq '[.assets[].name] | map(select(. == "latest.json")) | length'     # == 1
# heruntergeladene latest.json muss enthalten: darwin-aarch64, darwin-x86_64, linux-x86_64, windows-x86_64
# jeweils mit gesetztem url + signature; "version": "1.X.Y"
```

**Workflow-Quelle:** `.github/workflows/release.yml` — Matrix-Build über macOS (arm64+x64),
Windows, Linux (ubuntu-22.04); `tauri-apps/tauri-action@v0` erzeugt das GitHub-Release selbst
(`releaseDraft: false`), **kein manuelles `gh release create` nötig**.

**Vorbedingung, oft übersehen (D2, aus CONTEXT.md wörtlich zitiert):** Der Server-Code muss
VOR dem Produktionslauf deployed sein, sonst existiert das Skript auf dem Server nicht
(06-07-SUMMARY.md, „Deployment als notwendige Vorbedingung, im Plan nicht vorgesehen" —
`git push origin main` + `gh run list --workflow="deploy-server.yml" --limit 1` +
Health-Check `curl http://129.159.8.19:3000/api/health`, dann erst das Skript ausführen).

---

## Shared Patterns

### Produktionsschutz (`assertNotProduction`)
**Quelle:** `server/src/scripts/productionGuard.ts` (vollständig oben zitiert)
**Anwenden auf:** jedes Skript, das gegen eine Kopie/Generalprobe läuft (NICHT auf den
finalen `--apply`-Lauf gegen echte Produktion — der läuft *bewusst* gegen Produktion, siehe
Abschnitt 2 oben, Absatz zu D2 `autonomous: false`).
**Test-Analog:** `server/src/scripts/productionGuard.test.ts` (vollständig, 91 Zeilen) —
drei Auslöser einzeln getestet (Pfadgleichheit, `NODE_ENV=production`, Substring-Rückfall),
plus eine Gegenprobe. Wenn Phase 14 einen weiteren Guard-Nutzer testet, dieses Muster
1:1 übernehmen (`vi.stubEnv`, `vi.spyOn(process, 'exit')` wirft statt wirklich zu beenden).

### `DATABASE_PATH`-Pflicht ohne stillen Rückfall
**Quelle:** `server/src/scripts/snapshotBalances.ts:187-195`
```typescript
if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
  console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
  process.exit(2);
}
```
**Anwenden auf:** jedes Skript, das gegen die Produktionsdatenbank laufen soll (D4).
Ergänzend: `.github/workflows/deploy-server.yml:44-50` zeigt das Muster für
Workflow-Schritte (`export DATABASE_PATH=/home/ubuntu/databases/production.db` vor jedem
DB-berührenden Schritt) — bereits vorhanden und in D4 als „inzwischen überall stimmt" zu
verifizieren, nicht neu zu bauen.

### Testnutzer-Fixtures für Perioden-Tests
**Quelle:** `server/src/test-support/workPeriodFixtures.ts` (vollständig, 101 Zeilen)
```typescript
export function insertTestWorkPeriod(userId: number, options: InsertTestWorkPeriodOptions): UserWorkPeriod {
  return createWorkPeriod({ userId, validFrom: options.validFrom, validTo: options.validTo ?? null,
    weeklyHours: options.weeklyHours, workSchedule: options.workSchedule ?? null,
    note: options.note ?? 'insertTestWorkPeriod-fixture' });
}
```
**Anwenden auf:** alle neuen REQ-32-Testfälle — kein eigenes Insert-SQL schreiben, sondern
`insertTestWorkPeriod()` + `createEmployee()`-Helfer (lokal je Testdatei dupliziert, siehe
`workPeriodChangeService.test.ts:72-97` und `workPeriodDeletionService.test.ts:71-96` —
bewusst NICHT in eine gemeinsame Datei ausgelagert, jede Testdatei hat ihr eigenes
Nutzer-Präfix `test-XX-YY-` zur Kollisionsvermeidung bei parallelen Testläufen).

### Aufräumnachweis am Dateiende
**Quelle:** `workPeriodChangeService.test.ts:1158` (letzte Zeile der Datei)
```typescript
it('Aufraeumnachweis: kein Testnutzer mit Praefix test-12-05- bleibt zurueck, checkAllPeriodChains() meldet fuer die angelegten Testnutzer nichts', () => { /* ... */ });
```
**Anwenden auf:** jede neue REQ-32-Testdatei/jeden neuen `describe`-Block — letzter Test
prüft, dass kein Testnutzer mit dem eigenen Präfix übrig bleibt.

### Datumsarithmetik ohne Timezone-Bug
**Quelle:** wiederholt in allen drei Testdateien (`isoDate()`, `firstOfMonthOffset()`,
z. B. `workPeriodChangeService.test.ts:117-136`)
```typescript
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```
**Anwenden auf:** jede Datumsberechnung in Tests — niemals `new Date('YYYY-MM-DD')` oder
`.toISOString().split('T')[0]` (Zeitzonen-Off-by-one, wiederholt als Regel in
`.claude/CLAUDE.md` und in mehreren Testdatei-Kopfkommentaren referenziert).

---

## Kein Analog nötig

Alle für Phase 14 identifizierten Artefakttypen haben ein direktes Vorbild im Projekt. Es
gibt keine Kategorie „No Analog Found" — das ist der Normalfall für eine reine
Absicherungs-/Auslieferungsphase, die laut CONTEXT.md D3 „dasselbe Muster wie in Plan 06-07"
und laut Roadmap-Randbedingung „bestehende Muster nutzen statt neue erfinden" verlangt.

---

## Umgebungs-Constraints (für den Planner, nicht Teil eines einzelnen Patterns)

- Arbeits-DB ist `server/database/development.db`. `server/database.db` ist ein unmigrierter
  Altbestand (April 2026) — niemals verwenden, auch nicht versehentlich als Default irgendeines
  Skripts.
- `vitest` läuft in `desktop/` nicht (fehlendes `@babel/runtime`) — Desktop-Prüfungen laufen
  über `npx tsx` + `node:assert` (`check:rules`-Muster, siehe Abschnitt 7).
- npm-Workspaces hoisten zum Repo-Root — im Haupt-Worktree arbeiten, nicht in einem isolierten
  Worktree.
- Playwright-Browser sind lokal nicht lauffähig (Versions-Skew); Installation nicht autorisiert.
- Jeder Skriptaufruf gegen eine echte oder kopierte Produktionsdatenbank setzt `DATABASE_PATH`
  explizit — kein Skript verlässt sich auf einen Symlink oder Default.

## Metadaten

**Suchbereich:** `server/src/scripts/`, `server/src/database/migrations/`,
`server/src/services/*.test.ts`, `server/src/test-support/`, `desktop/package.json`,
`desktop/src/components/**/*.check.ts`, `.github/workflows/`, `.planning/milestones/v2.0-phases/06-*`,
`.planning/milestones/v2.0-phases/08-*`
**Gescannte Dateien:** ~20 vollständig gelesen, weitere per `grep`/`find` lokalisiert
**Datum der Erhebung:** 2026-08-23
