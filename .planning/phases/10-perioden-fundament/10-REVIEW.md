---
phase: 10-perioden-fundament
reviewed: 2026-08-22T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - server/src/database/migrations/008_create_user_work_periods.ts
  - server/src/database/migrations/009_backfill_user_work_periods.ts
  - server/src/services/workPeriodService.ts
  - server/src/scripts/productionGuard.ts
  - server/src/scripts/applyMigrationsToCopy.ts
  - server/src/scripts/snapshotBalances.ts
  - server/src/database/schema.ts
  - server/src/types/index.ts
  - server/package.json
  - server/src/database/migrations/008_create_user_work_periods.test.ts
  - server/src/database/migrations/009_backfill_user_work_periods.test.ts
  - server/src/database/userWorkPeriods.constraints.test.ts
  - server/src/database/schemaMigrationParity.test.ts
  - server/src/services/workPeriodService.test.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-22
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Migration 008/009, `workPeriodService.ts` und die drei CLI-Werkzeuge sind fachlich sehr
sorgfältig gebaut: das halboffene Intervall `[validFrom, validTo)` ist in
`resolveWorkPeriodAt()` korrekt und zeitzonenfrei umgesetzt (reiner Zeichenkettenvergleich,
kein `Date`, kein SQL-Datumsfunktion), inklusive Fail-Fast bei abweichendem Datumsformat.
`schema.ts` und Migration 008 sind nachweislich (per `schemaMigrationParity.test.ts`)
wortgleich. Die Produktionsschutz-Reihenfolge (Guard vor jedem datenbanköffnenden Import) ist
in allen drei Skripten eingehalten, und `snapshotBalances.ts` ruft tatsächlich ausschließlich
den nebenwirkungsfreien Lesepfad in `unifiedOvertimeService.ts` auf (grep- und codebestätigt:
keine `INSERT`/`UPDATE`/`DELETE` in dieser Datei).

Der schwerwiegendste Befund liegt aber nicht in einer der Phase-10-Dateien selbst, sondern in
ihrer Abhängigkeit von einer pre-existierenden Infrastrukturdatei
(`migrationRunner.ts`): Die dort fehlende `await`-Kette bedeutet, dass die in Migration
008/009 mehrfach wörtlich zugesicherte Selbstverifikation ("Migration wird NICHT als
angewendet markiert") über den echten Serverstart-Pfad **nicht** greift — reproduziert und
belegt unten (CR-01). Zusätzlich zwei Warnings zu einer Lücke im DELETE-Trigger und einer
`any`-Verwendung.

## Critical Issues

### CR-01: Migrationsläufer markiert fehlgeschlagene Migrationen fälschlich als angewendet — die in 008/009 dokumentierte Selbstverifikation greift nicht

**File:** `server/src/database/migrationRunner.ts:60-66` (Root Cause; betrifft direkt
`server/src/database/migrations/008_create_user_work_periods.ts` und
`server/src/database/migrations/009_backfill_user_work_periods.ts`, deren gesamte
Selbstverifikations-Erzählung sich hierauf verlässt)

**Issue:**
`migrationRunner.ts` führt jede Migration so aus:

```ts
const runMigration = db.transaction(() => {
  migration.up(db);
  recordMigration(db, migration.name);
});
runMigration();
```

`migration.up` ist in **beiden** Phase-10-Migrationen als `async up(db) { ... }` deklariert
(008:64, 009:101), wird hier aber **nicht awaitet**. In JavaScript wird ein `throw` innerhalb
einer `async function` — auch wenn er synchron und ohne jedes `await` im Funktionskörper
erfolgt — nicht als synchroner Fehler an den Aufrufer weitergereicht, sondern in eine
*rejected Promise* verwandelt. Der umschließende `db.transaction(() => { ... })`-Callback ist
selbst synchron und `await`et den Rückgabewert von `migration.up(db)` nicht — der Reject
bleibt unbeachtet. Die Folge:

1. Alle SQL-Anweisungen, die vor dem `throw` in `up()` bereits ausgeführt wurden, bleiben Teil
   der (nicht zurückgerollten) Transaktion.
2. `recordMigration(db, migration.name)` läuft trotzdem und schreibt die Migration als
   erfolgreich in die `migrations`-Tabelle.
3. `runMigration()` wirft nicht synchron, der `try/catch` in `runMigrations()`
   (migrationRunner.ts:59-71) greift **nicht** — der Fehler taucht erst später als unhandled
   promise rejection auf, nachdem die Transaktion längst committet ist.

Ich habe das isoliert gegen `better-sqlite3` reproduziert (identisches Muster: async `up()`,
Wurf nach einem bereits ausgeführten INSERT, `db.transaction()`-Wrapper ohne `await`):

```
transaction() did NOT throw synchronously
Rows after transaction: [{"id":1,"v":"before-throw"},{"id":2,"v":"recordMigration-called-anyway"}]
```

Beide `before-throw`- und `recordMigration-called-anyway`-Zeilen landen in der Tabelle — exakt
das hier beschriebene Verhalten.

**Warum das für Migration 008/009 kritisch ist:** Beide Dateien behaupten wörtlich und
mehrfach, ihre Selbstverifikation sei ein **mechanischer** Garant, keine bloße Behauptung:

- 008:100-114 / 120-126 / 154-159 / 258-263: "Migration wird NICHT als angewendet markiert"
  (viermal wiederholt, je nach geprüfter Invariante: fehlende Spalten, fehlende Indizes,
  fehlende Trigger).
- 009:188-190 / 197-201 / 212-217 / 233-239: dieselbe Zusicherung für "Nutzer ohne Periode",
  "Nutzer mit mehr als einer Periode", "Perioden weichen von den aktuellen users-Werten ab"
  (REQ-21-Nachweis).

Mit dem gefundenen Verhalten ist diese Zusicherung **falsch**: Schlägt eine dieser
Selbstprüfungen fehl (z. B. weil Migration 009 mitten im Lauf durch einen anderen Fehler
abbricht und `usersWithoutPeriod > 0` zurückliefert), wird die Migration trotzdem als
erfolgreich in `migrations` eingetragen. Ein erneuter Serverstart würde sie **nicht** erneut
versuchen (sie gilt ja als "executed" laut `getExecutedMigrations()`,
migrationRunner.ts:111-115), obwohl der Datenbestand nachweislich die verlangten Invarianten
nicht erfüllt. Für Migration 009 bedeutet das im schlimmsten Fall: ein Teil der Nutzer bekommt
keine Periode, die Migration gilt aber als erledigt — genau der halbe Zustand, den die
Dokumentation in 009:35-39 ausdrücklich ausschließen will ("Ein zweiter Lauf dieser Migration
erzeugt daher keine zweite Periode" setzt voraus, dass der erste Lauf entweder vollständig
oder gar nicht als "executed" markiert ist; das gefundene Verhalten erzeugt einen dritten,
nicht vorgesehenen Zustand: teilweise angewendet UND als vollständig markiert).

Die vorhandenen Unit-Tests (`008_create_user_work_periods.test.ts:79-97`,
`009_backfill_user_work_periods.test.ts`) verdecken das, weil sie `migration.up(db)` direkt
mit `await` aufrufen (`await migration.up(db)` bzw.
`await expect(migration.up(db)).resolves...`) — korrekt awaitet, und decken damit den
fehlerhaften Pfad durch `migrationRunner.ts` nicht ab. `schemaMigrationParity.test.ts:60` ruft
`migration008.up(dbB)` sogar ganz ohne `await` auf, bleibt aber grün, weil im Erfolgsfall
(kein Wurf) alle Anweisungen trotzdem synchron vollständig laufen, bevor die nächste Zeile
liest — der Test prüft also nur den Erfolgspfad, nicht den hier beschriebenen Fehlerpfad.

**Einordnung:** `migrationRunner.ts` selbst ist keine in Phase 10 geänderte Datei (das
`async up()`-Muster existiert schon in den Migrationen 001–007). Der Befund wird trotzdem als
Blocker eingestuft, weil die beiden Phase-10-Dateien ihre zentrale Korrektheitsgarantie
(„mechanisch garantiert statt nur behauptet") ausdrücklich auf ein Verhalten stützen, das
nachweislich nicht existiert — die Selbstverifikation in 008/009 ist damit wirkungslose
Dekoration, sobald sie über den echten Serverstart-Pfad (`server.ts:210` → `runMigrations()`)
statt über die Tests läuft.

**Fix:** In `migrationRunner.ts` die Transaktion async-fähig machen bzw. den Fehler synchron
propagieren lassen, z. B.:

```ts
// migrationRunner.ts
for (const migration of pendingMigrations) {
  logger.info(`⏳ Running migration: ${migration.name}`);
  try {
    db.exec('BEGIN');
    await migration.up(db);       // <-- awaiten!
    recordMigration(db, migration.name);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    logger.error({ error }, `❌ Migration failed: ${migration.name}`);
    throw new Error(`Migration ${migration.name} failed: ${error}`);
  }
}
```

(better-sqlite3s `db.transaction()`-Helper unterstützt keine async Callbacks — daher hier
manuelles `BEGIN`/`COMMIT`/`ROLLBACK` statt `db.transaction(fn)`, oder alternativ die
Migrationsfunktionen synchron machen — für 008/009 tatsächlich möglich, da beide keine
einzige `await`-Anweisung im Körper haben.)

---

## Warnings

### WR-01: DELETE-Trigger schützt nicht davor, die einzige Periode eines noch existierenden Nutzers zu löschen

**File:** `server/src/database/migrations/008_create_user_work_periods.ts:220-232`
(wortgleich gespiegelt in `server/src/database/schema.ts:336-348`)

**Issue:** `trg_user_work_periods_delete_guard` blockiert eine Löschung nur, wenn **alle**
drei Bedingungen zutreffen: `OLD.validTo IS NOT NULL`, der Nutzer existiert noch, UND es
existieren sowohl eine Vorgänger- als auch eine Nachfolgerperiode. Für die (laut Migration 009
nach jedem Lauf garantierte) **einzige, offene** Periode eines Nutzers ist `OLD.validTo IS
NULL` — die erste Bedingung ist damit bereits falsch, der komplette `WHERE`-Ausdruck wertet zu
`false` aus, und `DELETE FROM user_work_periods WHERE id = ?` auf genau diese Zeile läuft
ungehindert durch, während der Nutzer selbst weiter existiert. Ergebnis: ein Nutzer mit zuvor
genau einer Periode hat danach **keine** Periode mehr — exakt der Zustand, den Migration 009
in ihrer eigenen Selbstverifikation (009:190-202, `usersWithoutPeriod`) als Fehlschlag
behandelt, wenn er direkt nach dem Backfill auftritt. Der Trigger verhindert nur *Lücken
zwischen* Perioden, nicht das *Leerlaufen* der Kette auf null Perioden bei fortbestehendem
Nutzer.

Das ist kein Versehen, sondern nachweislich getestetes, gewolltes Verhalten:
`userWorkPeriods.constraints.test.ts:111-118` prüft explizit
`'erlaubt DELETE der letzten (offenen) Periode'` mit `.not.toThrow()`. Aktuell hat kein
Aufrufer in Phase 10 Zugriff auf einen solchen `DELETE` (`workPeriodService.ts` exportiert
keine Löschfunktion, „die eine Auflösungsstelle" schreibt nur `INSERT`/`UPDATE`) — der Befund
ist also derzeit nicht über den Service-Layer erreichbar. Da Phase 11 aber laut
Kopfkommentar von `workPeriodService.ts:36-38` als erster echter Aufrufer der Perioden geplant
ist und die Datenbank die einzige harte Garantie für die Kettenintegrität ist (008:17-21,
„SQLite kennt keine Range-Exclusion-Constraints... deshalb übernehmen... Trigger"), fehlt hier
ein Riegel gegen genau die Invariante, die Migration 009 aktiv herstellt und selbst prüft
("jeder Nutzer hat mindestens eine Periode") — ein künftiger Aufrufer kann sie über einen
einzigen `DELETE` lautlos brechen, ohne dass die Datenbank protestiert.

**Fix:** Die Bedingung um den Fall „letzte verbleibende Periode, Nutzer existiert noch"
erweitern, z. B. zusätzliche `RAISE`-Klausel:

```sql
SELECT RAISE(ABORT, 'user_work_periods: Löschen würde den Nutzer ohne jede Periode zurücklassen')
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
  AND NOT EXISTS (
    SELECT 1 FROM user_work_periods p
    WHERE p.userId = OLD.userId AND p.id <> OLD.id
  );
```
(deckt sowohl die offene als auch eine hypothetische geschlossene Alleinperiode ab; muss in
`008_create_user_work_periods.ts` UND `schema.ts` gleichlautend ergänzt werden, sonst bricht
`schemaMigrationParity.test.ts`.)

### WR-02: `snapshotBalances.ts` verwendet explizites `any` entgegen der Projektregel „kein `any`"

**File:** `server/src/scripts/snapshotBalances.ts:334-335`

**Issue:**
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectUser(db: any, unifiedOvertimeService: any, userId: number, asOf: string): UserSnapshot {
```
`.claude/CLAUDE.md` verlangt strikt „❌ NIEMALS `any` Type verwenden → `unknown` + Type Guards
nutzen" und listet das unter den Pre-Commit-Quality-Gates ausdrücklich auf
("☐ Keine `any` Types"). Hier wird die Regel nicht nur verletzt, sondern die Lint-Regel per
Kommentar bewusst stummgeschaltet, statt echte Typen zu importieren (`Database.Database` aus
`better-sqlite3`, die Klasse `UnifiedOvertimeService` aus `unifiedOvertimeService.js`). Da
beide Parameter unmittelbar aus typisierten Modulen stammen (`db` aus
`../database/connection.js`, `unifiedOvertimeService` aus
`../services/unifiedOvertimeService.js`, beide bereits in `main()` per `await import(...)`
geladen), wäre eine korrekte Typisierung ohne Mehraufwand möglich. Bemerkenswert im Kontrast:
`types/index.ts:269` kommentiert für `UserWorkPeriodRow` ausdrücklich „...passiert im Service
..., nicht hier mit `any`" — die gleiche Disziplin fehlt hier.

**Fix:**
```ts
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import type { UnifiedOvertimeService } from '../services/unifiedOvertimeService.js';

function collectUser(
  db: BetterSqlite3Database,
  unifiedOvertimeService: UnifiedOvertimeService,
  userId: number,
  asOf: string
): UserSnapshot {
```

### WR-03: `assertNotProduction()` hat keine automatisierten Tests

**File:** `server/src/scripts/productionGuard.ts:42-62`

**Issue:** Für alle anderen sicherheitsrelevanten Verhaltensweisen dieser Phase existieren
dichte, automatisierte Testmatrizen (19 Trigger-Tests in
`userWorkPeriods.constraints.test.ts`, sechs Grenzfall-Nutzer in
`009_backfill_user_work_periods.test.ts`, DST/Schalttag/Formatfehler in
`workPeriodService.test.ts`). `assertNotProduction()` — die einzige Funktion, die einen
versehentlichen Schreibzugriff auf die Produktionsdatenbank verhindert (siehe die explizite
Warnung im Kopfkommentar von `applyMigrationsToCopy.ts:14-19` zum Vorfall vom 18.08.2026) —
hat dagegen **keine** Testdatei (`server/src/scripts/*.test.ts` enthält nur
`overtimePathComparison.test.ts`; `grep -rl "assertNotProduction" server/src/**/*.test.ts`
liefert keinen Treffer). Die Verifikation dieser Funktion stützt sich laut
`10-02-SUMMARY.md:353` auf einen manuellen `grep`-Nachweis und einen einmaligen Lauf gegen
eine Kopie — nicht auf einen automatisierten Test, der bei einer künftigen Änderung an
`getDatabasePath()`/`getProductionDatabasePath()` (z. B. im Zuge der für Phase 14 bereits
vorgemerkten Korrektur des veralteten Produktionspfad-Kommentars in `.claude/CLAUDE.md`)
sofort rot würde.

**Fix:** Minimaler Testfall, der die drei Auslöser (Pfadgleichheit, `NODE_ENV=production`,
Substring `"production"`) unabhängig voneinander abdeckt, z. B. durch Mocken von
`process.env` und Aufruf mit verschiedenen `explicitPath`-Werten, sowie eine Prüfung, dass ein
harmloser lokaler Pfad (`:memory:`-Äquivalent bzw. `./database/development.db`) NICHT
abgewiesen wird.

---

## Bereits geprüft, keine Befunde (Nachweis statt Behauptung)

- `workPeriodService.ts` — `resolveWorkPeriodAt()` (216-227): reiner TEXT-Vergleich
  (`validFrom <= ? AND (validTo IS NULL OR validTo > ?)`), kein `Date`-Konstruktor, kein
  `date()`/`strftime()`. Halboffenes Intervall korrekt: `validTo` selbst ist NICHT mehr Teil
  der Periode (`validTo > date`, nicht `>=`), gehört also an diesem Tag zur nächsten Periode,
  wie von D1 verlangt — durch `workPeriodService.test.ts:112-114` (`2026-08-01 löst P2 auf`)
  auch tatsächlich abgedeckt. `assertDateFormat()` (87-94) erzwingt `YYYY-MM-DD` zur Laufzeit
  für jeden öffentlichen Parameter (auch `date`, `validFrom`, `validTo`) — ein Wert wie
  `2026-1-5` bzw. `2026-8-1` schlägt am Regex `^\d{4}-\d{2}-\d{2}$` fehl und wirft, bevor er in
  einen Zeichenkettenvergleich gelangen könnte (getestet: `workPeriodService.test.ts:157-159`).
  DST-Umstellung (März/Oktober 2026) und Schalttag 2028-02-29 werden korrekt aufgelöst, ohne
  Wirkung auf das Ergebnis (`workPeriodService.test.ts:136-155`).
- `getCurrentWorkPeriod()` (187-203): wirft explizit bei >1 offener Periode statt eine der
  Zeilen stillschweigend zu bevorzugen — korrekt gegen den in WR-01 beschriebenen Fall
  abgesichert.
- `unifiedOvertimeService.ts`: verifiziert grep-bestätigt keine `INSERT`/`UPDATE`/`DELETE`;
  `calculatePeriodOvertime()` und alle privaten Hilfsmethoden (`getUser`, `getWorkedHours`,
  `getAbsenceCredit`, `getCorrections`, `getUnpaidReduction`) sind reine `SELECT`-Lesepfade.
  `snapshotBalances.ts` ruft ausschließlich diesen Weg auf — die im Kopfkommentar behauptete
  Nebenwirkungsfreiheit ist damit tatsächlich zutreffend.
- `productionGuard.ts` / `applyMigrationsToCopy.ts` / `snapshotBalances.ts`: Reihenfolge
  Import → `assertNotProduction()` → erst danach `new Database(...)` bzw.
  `await import('../database/connection.js')` in allen drei Dateien eingehalten;
  `migrationRunner.ts` und die Migrationsdateien 001–009 importieren `connection.js`
  nachweislich nicht (grep bestätigt), öffnen also selbst über den `loadMigrations()`-Dynamic-
  Import keine Datenbank am Modulkopf. Kein `PRAGMA foreign_keys = OFF` in einer der
  Scope-Dateien (nur in vorbestehenden, unveränderten `schema.ts:109` bzw.
  `fixOvertimeTransactionsSchema.ts`, außerhalb des Scopes).
- `schema.ts` vs. Migration 008: durch `schemaMigrationParity.test.ts` maschinell auf
  Wortgleichheit geprüft (inkl. Gegenprobe, dass eine echte Abweichung den Test rot machen
  würde) — Tabelle, Trigger und Indizes stimmen überein.
- Migration 009 — Ersatzdatum-Kette (`resolveValidFrom`, 009:75-88): leerer String und
  fehlerhaft formatiertes `hireDate` fallen korrekt auf `earliestEntryDate` zurück (Regex
  `^\d{4}-\d{2}-\d{2}$` schließt `''`, `'2026-1-1'`, `'01.01.2026'` aus — getestet in
  `009_backfill_user_work_periods.test.ts:27-33`); fehlen beide, greift
  `FALLBACK_PROJECT_START`, nie ein erfundenes Epoch-Datum (Test 40-46). Ein `hireDate` in der
  Zukunft wird nicht gesondert behandelt, führt aber lediglich zu einer Periode mit
  zukünftigem `validFrom` — kein Fehlerfall, da `resolveWorkPeriodAt()` für Daten vor diesem
  `validFrom` korrekt `null` liefert statt falsch zu werten.
- `types/index.ts` (`UserWorkPeriod`, `UserWorkPeriodRow`, 252-280) und `package.json`
  (`migrate:copy`, `snapshot:balances`, 16-17): keine Abweichungen zur tatsächlichen Nutzung in
  `workPeriodService.ts` bzw. den beiden Skripten gefunden.
- Kein `toISOString().split('T')[0]` in `server/src/**` (grep-bestätigt).

---

_Reviewed: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
