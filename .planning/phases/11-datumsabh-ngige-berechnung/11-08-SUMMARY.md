---
phase: 11-datumsabh-ngige-berechnung
plan: 08
subsystem: validation-tooling
tags: [overtime, work-periods, cli-scripts, sqlite, typescript]

# Dependency graph
requires:
  - phase: 11-datumsabh-ngige-berechnung
    provides: "Plan 11-04: neue Pflichtsignaturen (WorkPeriodContext-Parameter) fuer getDailyTargetHours, calculateAbsenceHoursWithWorkSchedule, calculateTargetHoursForPeriod"
  - phase: 11-datumsabh-ngige-berechnung
    provides: "Plan 11-02/11-03: createWorkPeriodContext(), stubWorkPeriodContext()-Testfixture"
provides:
  - "Fuenf Werkzeug-/Migrationsskripte periodenbewusst (REQ-25): validateOvertimeDetailed.ts, validateOvertimeCalculation.ts, validateAllTestUsers.ts, migrateOvertimeToTransactions.ts, reproduceOvertimeCompDefect.ts"
  - "Periodenausgabe (validFrom/validTo/weeklyHours) in validateOvertimeDetailed.ts vor dem Vergleich"
  - "Produktionsschutz nachgeruestet in migrateOvertimeToTransactions.ts (T-11-27)"
  - "11-AUFRUFER-TEIL-08.md: Teilbeleg fuer die Zusammenfuehrung in Plan 11-09"
affects: ["11-09 (Zusammenfuehrung Aufrufer-Checkliste, projektweites tsc)", "11-10 (Nullwirkungs-Nachweis, 11-nullwirkung.db unveraendert)"]

tech-stack:
  added: []
  patterns:
    - "WorkPeriodContext-Parameter: DB-gestuetzte Validierungslaeufe nutzen createWorkPeriodContext() (ein Kontext je Nutzer-/Monatslauf), synthetische Test-/Szenariodaten ohne DB-Repraesentation nutzen stubWorkPeriodContext() aus test-support/workPeriodFixtures.ts — beide loesen ueber dieselbe resolveWorkPeriodIn()-Funktion auf"
    - "ensureDependencies()-Ladefunktion mit dependenciesLoaded-Flag fuer Skripte mit mehreren exportierten Einstiegspunkten (migrateOvertimeToTransactions.ts), statt eines main()-Wrappers"

key-files:
  created:
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-08.md
    - .planning/phases/11-datumsabh-ngige-berechnung/deferred-items.md
  modified:
    - server/src/scripts/validateOvertimeDetailed.ts
    - server/src/scripts/validateOvertimeCalculation.ts
    - server/src/scripts/validateAllTestUsers.ts
    - server/src/scripts/migrateOvertimeToTransactions.ts
    - server/src/scripts/reproduceOvertimeCompDefect.ts

key-decisions:
  - "validateScenario() in validateOvertimeCalculation.ts nutzt stubWorkPeriodContext() statt createWorkPeriodContext(), weil Szenario-Nutzer synthetische in-memory Zaehler-IDs sind, die nicht in user_work_periods existieren — createWorkPeriodContext() haette MissingWorkPeriodError geworfen und den kompletten --scenario=-Modus des Werkzeugs unbenutzbar gemacht"
  - "Produktionsschutz in migrateOvertimeToTransactions.ts nachgeruestet (Rule 2/T-11-27), obwohl nicht explizit in den read_first-Zeilen des Plans genannt: das Skript SCHREIBT Ueberstundentransaktionen und importierte db/getDailyTargetHours/getUserById zuvor statisch ohne Guard — auf einem Server mit NODE_ENV=production und ohne DATABASE_PATH haette es beim Import bereits die Produktionsdatenbank geoeffnet"
  - "validateAllTestUsers.ts's fehlender Produktionsschutz (fest verdrahteter Pfad ./database/development.db, DATABASE_PATH wird ignoriert) bewusst NICHT nachgeruestet: ein assertNotProduction()-Guard wuerde getDatabasePath() pruefen, was die tatsaechliche Verbindung dieses Skripts gar nicht benutzt — Guard-Theater statt echtem Schutz. Dokumentiert in deferred-items.md fuer die in productionGuard.ts bereits vorgesehene Konsolidierung (Phase 9.1/14)"

patterns-established:
  - "Ein WorkPeriodContext pro Berechnungslauf (Nutzer/Monat bzw. Nutzer-Migrationslauf), niemals pro Tag in einer Tagesschleife erzeugt — konsistent mit D1/D2 aus workPeriodContext.ts"

requirements-completed: [REQ-25, REQ-23]

duration: 35min
completed: 2026-08-22
---

# Phase 11 Plan 08: Validierungswerkzeuge periodenbewusst Summary

**Fuenf CLI-Werkzeuge (validate:overtime:detailed, validate:overtime, validate:all-test-users, migrate:overtime, repro:overtime-comp) messen jetzt gegen den periodengueltigen Massstab statt gegen den aktuellen Nutzerstamm (REQ-25).**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-22
- **Tasks:** 3/3
- **Files modified:** 5 (Skripte) + 2 (Teilbeleg, Deferred Items)

## Accomplishments

- `validateOvertimeDetailed.ts` gibt vor jedem Vergleich die gueltigen Perioden
  (validFrom/validTo/weeklyHours) des geprueften Nutzers aus — ein Befund bei einem Nutzer
  mit Modellwechsel ist jetzt deutbar statt eines stillen Artefakts.
- Alle vier ubrigen Skripte auf die neuen Pflichtsignaturen aus Plan 11-04 gebracht, jeweils
  mit genau einem `WorkPeriodContext` je Berechnungslauf (nicht je Tag).
- `migrateOvertimeToTransactions.ts` — ein schreibendes Migrationsskript ohne jeden
  Produktionsschutz — hat jetzt `assertNotProduction()` plus dynamischen Importblock nach dem
  etablierten Muster (Rule 2, T-11-27).
- `reproduceOvertimeCompDefect.ts` rechnet `erwarteterAbzug` jetzt mit demselben
  periodengueltigen Massstab wie `absenceService` (Plan 11-07) — vorher haette das Werkzeug ab
  jetzt einen selbst erzeugten Defekt reproduziert statt den echten REQ-19-Befund.
- Alle Probelaeufe gegen `server/database/11-werkzeugprobe.db`; `11-nullwirkung.db`
  nachweislich unveraendert (Groesse/Zeitstempel vor und nach identisch, siehe Teilbeleg).

## Task Commits

1. **Task 1: validateOvertimeDetailed — der Pruefmassstab selbst (REQ-25)** - `8162fe7` (feat)
2. **Task 2: Die uebrigen Werkzeug- und Migrationsskripte** - `e3196cf` (feat)
3. **Task 3: Teilbeleg fuer Plan 11-09** - `97a65ca` (docs)

**Plan metadata:** siehe Endcommit dieses Executor-Laufs (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Files Created/Modified

- `server/src/scripts/validateOvertimeDetailed.ts` — Halter auf neue Signatur, dynamischer
  Import von `createWorkPeriodContext`/`getWorkPeriods`, EIN Kontext je Nutzer-/Monatslauf an
  allen drei Aufrufstellen, Periodenausgabe vor dem Vergleich, REQ-25-Absatz im Kopfkommentar
- `server/src/scripts/validateOvertimeCalculation.ts` — `validateUser()` nutzt
  `createWorkPeriodContext()`, `validateScenario()` nutzt `stubWorkPeriodContext()` (aus
  `test-support/workPeriodFixtures.ts`); vier Aufrufstellen (`calculateTargetHoursForPeriod`
  x2, `calculateAbsenceHoursWithWorkSchedule` x2) auf `(user, ..., periods)` umgestellt
- `server/src/scripts/validateAllTestUsers.ts` — zwei `getDailyTargetHours`-Aufrufstellen auf
  `(user, dateStr, periods)` gebracht, ein Kontext je `validateUser()`-Aufruf; bestehende
  Produktionsschutz-Luecke bewusst unangetastet (siehe Deviations/Deferred Issues)
- `server/src/scripts/migrateOvertimeToTransactions.ts` — `assertNotProduction()` neu
  eingefuehrt, `ensureDependencies()`-Ladefunktion (dynamischer Importblock) ersetzt
  statische Importe von `db`/`logger`/`getDailyTargetHours`/`getUserById`/
  `recordOvertimeEarned`/`deleteEarnedTransactionsForDate`, EIN Kontext je
  Nutzer-Migrationslauf
- `server/src/scripts/reproduceOvertimeCompDefect.ts` — `erwarteterAbzug`-Schleife nutzt
  jetzt `createWorkPeriodContext()` und eine synthetische `UserPublic` aus der bereits
  geladenen `userRow` statt der alten Vier-Parameter-Signatur
- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-08.md` — Teilbeleg mit 11
  Fundstellen, grep-Belegen je Datei und Probelauf-Ausgaben
- `.planning/phases/11-datumsabh-ngige-berechnung/deferred-items.md` — zwei
  pre-existierende, out-of-scope Funde dokumentiert (siehe unten)

## Decisions Made

- `stubWorkPeriodContext()` statt einer eigenen Mock-Logik fuer den Szenario-Modus von
  `validateOvertimeCalculation.ts` — nutzt die bereits vorhandene Testfixture aus
  `test-support/workPeriodFixtures.ts` (Vorgabe: "benutzen, nicht nachbauen"), keine zweite
  Auflösungslogik.
- Produktionsschutz in `migrateOvertimeToTransactions.ts` nachgeruestet statt nur die Signatur
  zu aendern — ein schreibendes Migrationsskript ohne Guard ist ein direktes T-11-27-Risiko,
  das mit derselben Änderung (Umstellung auf dynamische Importe) ohnehin beruehrt wurde.
- Produktionsschutz in `validateAllTestUsers.ts` NICHT nachgeruestet — der feste DB-Pfad
  macht einen `getDatabasePath()`-basierten Guard dort wirkungslos; siehe Deferred Issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4→Rule 1, dokumentiert statt architekturell] `validateScenario()` haette mit reiner Signatur-Nachfuehrung MissingWorkPeriodError geworfen**
- **Found during:** Task 2 (`validateOvertimeCalculation.ts`)
- **Issue:** Die neue Signatur von `calculateTargetHoursForPeriod`/`calculateAbsenceHoursWithWorkSchedule` verlangt einen `WorkPeriodContext`. `validateScenario()` arbeitet mit rein synthetischen, nur im Speicher existierenden Testnutzern (`createTestScenario()` aus `generateTestData.ts`, in-memory Zaehler-ID). `createWorkPeriodContext()` haette fuer diese Nutzer `getWorkPeriods(userId)` gegen die echte DB abgefragt, ein leeres Ergebnis erhalten und (da die Testdaten-Daten nicht vor `hireDate` liegen) `MissingWorkPeriodError` geworfen — der komplette `--scenario=`-Modus des Werkzeugs waere unbenutzbar geworden.
- **Fix:** `stubWorkPeriodContext()` aus der bereits vorhandenen Testfixture `server/src/test-support/workPeriodFixtures.ts` verwendet — baut eine einzelne, ab `hireDate` gueltige Periode aus dem Szenario-`workSchedule`/`weeklyHours`, loest aber ueber dieselbe `resolveWorkPeriodIn()`-Funktion auf wie der echte Kontext.
- **Files modified:** `server/src/scripts/validateOvertimeCalculation.ts`
- **Verification:** Probelaeufe `--scenario=hans-individual-schedule` und `--scenario=vacation-week` gegen `11-werkzeugprobe.db` liefern exakt die erwarteten Werte (Erwartet == Berechnet, alle drei Validierungen ✅) — siehe Teilbeleg.
- **Committed in:** `e3196cf`

**2. [Rule 2 - Missing Critical] Produktionsschutz in migrateOvertimeToTransactions.ts nachgeruestet**
- **Found during:** Task 2 (`migrateOvertimeToTransactions.ts`)
- **Issue:** Das Skript schreibt Ueberstundentransaktionen (`recordOvertimeEarned`) und importierte `db` (aus `database/connection.js`), `getDailyTargetHours`, `getUserById` statisch am Dateikopf, ohne jeden `assertNotProduction()`-Guard. Auf dem Produktionsserver (`NODE_ENV=production`, `.claude/CLAUDE.md` → CI/CD Environment Variables) und ohne explizit gesetztes `DATABASE_PATH` haette bereits der `import` die Produktionsdatenbank geoeffnet — exakt das Schadensmuster aus dem WAL-Vorfall vom 18.08.2026 (`.planning/debug/db-stabilisierung-20260818.md`), diesmal potenziell mit echten Schreiboperationen.
- **Fix:** `assertNotProduction()` (identisches Muster wie `validateOvertimeDetailed.ts`/`reproduceOvertimeCompDefect.ts`) synchron auf Modulebene ergaenzt; alle DB-beruehrenden Module (`connection.js`, `logger.js`, `workingDays.js`, `userService.js`, `workPeriodContext.js`, `overtimeTransactionService.js`) ueber eine `ensureDependencies()`-Funktion dynamisch geladen, aufgerufen am Kopf beider exportierten Funktionen (`migrateOvertimeToTransactions()`, `verifyMigration()`).
- **Files modified:** `server/src/scripts/migrateOvertimeToTransactions.ts`
- **Verification:** `npx tsc --noEmit` fehlerfrei; `grep -n "assertNotProduction\|import("` bestaetigt die Reihenfolge (Guard vor allen dynamischen Importen, siehe Teilbeleg). Kein Probelauf durchgefuehrt (schreibendes Skript, gemaess Plan nur "falls fuer eine dieser Dateien ein Probelauf noetig wird" — die Signatur- und Guard-Korrektheit ist durch `tsc` und grep hinreichend belegt).
- **Committed in:** `e3196cf`

---

**Total deviations:** 2 auto-fixed (1 architektonisch-praktische Entscheidung fuer eine bestehende Testfixture statt eines Bruchs des Szenario-Modus, 1 Missing-Critical/Sicherheitsluecke)
**Impact on plan:** Beide Fixes waren fuer Korrektheit (Szenario-Modus bleibt funktionsfaehig) bzw. Sicherheit (kein ungeschuetztes Schreiben in Produktion) notwendig. Kein Scope Creep — beide Aenderungen liegen in Dateien, die Task 2 ohnehin aendert.

## Issues Encountered

- `validateOvertimeCalculation.ts`'s DB-Modus (`--userId=`) bricht bei einer vorbestehenden,
  von diesem Plan nicht beruehrten `time_entries`-Abfrage mit `SqliteError: no such column:
  deletedAt` ab (Zeile 208, unveraendert seit vor diesem Plan). Der periodenbasierte Teil der
  Berechnung (Zielstunden ueber `calculateTargetHoursForPeriod`) laeuft davor nachweislich
  fehlerfrei durch — der Fehler liegt in einer unabhaengigen, spaeteren Query. Nicht behoben
  (out of scope), dokumentiert in `deferred-items.md`. Der Szenario-Modus (`--scenario=`) ist
  unbetroffen.
- `validateAllTestUsers.ts` hat keinen Produktionsschutz und ignoriert `DATABASE_PATH`
  vollstaendig (fest verdrahteter Pfad `./database/development.db`). Der Kommentar in
  `productionGuard.ts:17-19` behauptet faelschlich, dieses Skript habe "weiterhin eine eigene
  Kopie dieser Pruefung". Nicht behoben (ein `getDatabasePath()`-Guard waere hier
  wirkungslos, da die eigentliche Verbindung diesen Pfad nicht benutzt — eine echte Behebung
  erfordert eine Umstellung der DB-Verbindungsstrategie, ausserhalb des Scopes von "Signatur
  nachziehen"). Dokumentiert in `deferred-items.md`.

## Known Stubs

Keine — dieser Plan fuegt keine UI-Komponenten oder Datenquellen hinzu.

## Threat Flags

Keine neue Angriffsflaeche eingefuehrt. Die Erweiterung des Produktionsschutzes in
`migrateOvertimeToTransactions.ts` REDUZIERT die im Threat-Register (T-11-27) bereits
benannte Flaeche, fuegt keine neue hinzu.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness

- Plan 11-09 kann `11-AUFRUFER-TEIL-08.md` zusammen mit den Teilbelegen von 11-05, 11-06,
  11-07, 11-11 sequenziell in `11-AUFRUFER-CHECKLISTE.md` zusammenfuehren.
- `11-nullwirkung.db` ist nachweislich unveraendert — Plan 11-10 kann seinen
  Nullwirkungs-Nachweis auf dieser Grundlage fuehren.
- Zwei pre-existierende, nicht mit diesem Plan zusammenhaengende Probleme sind in
  `deferred-items.md` verankert und warten auf eine spaetere Phase (9.1/14 fuer die
  Produktionsschutz-Konsolidierung; die `time_entries.deletedAt`-Query ist bislang nirgends
  verankert und sollte bei Gelegenheit nachgetragen werden).

---
*Phase: 11-datumsabh-ngige-berechnung*
*Completed: 2026-08-22*

## Self-Check: PASSED
