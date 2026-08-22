---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 03
subsystem: api
tags: [sqlite, better-sqlite3, work-periods, overtime, correction, chain-guard]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 01)
    provides: "Migration 013 (deletedAt/deletedBy + work_period_chain_guard auf user_work_periods, aussetzbarer Kettenriegel)"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 02)
    provides: "getWorkPeriodById(), extendWorkPeriodTo(), updateWorkPeriodValues(), setWorkPeriodValidFrom(), withSuspendedChainGuard(), WorkPeriodCorrectionInput/Preview/Outcome, PreviewRollback<T>/runWithPreviewRollback() aus workPeriodChangeService.ts"
  - phase: 12-stundenwechsel-bedienen
    provides: "applyWorkTimeChange() als strukturelle Vorlage, sumTargetHoursInRange()/monthsInRange()/toGermanDate()/formatWeeklyHoursDe()/workScheduleEquals() als wiederverwendete Rechenbausteine"
provides:
  - "correctWorkPeriod() — der Schreibweg fuer 'Stammdaten korrigieren' (D1): eigene Datei, eigene Fehlerklasse, kein mode-Parameter, dryRun/Speichern ueber dieselbe Rechenbahn"
  - "Die in 13-01/13-02 offengelassene DD-2-Zusage eingeloest: withSuspendedChainGuard() gefolgt von checkPeriodChain() innerhalb derselben db.transaction()-Klammer (jetzt sogar unbedingt nach jedem Schreiben, auch ohne Riegel-Aussetzung, T-13-14)"
  - "11 Verhaltenstests: Pflichtbegruendung, Trockenlauf schreibt nicht, Vorschau=Speichern, rueckwirkende Wirkung, kein Rebuild vor rangeStart, Luecken-schliessender Beginn-Verschub in beide Richtungen, gesperrte erste Periode, 'nichts geaendert', Rollback bei Kettenfehler"
affects: [13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "checkPeriodChain() laeuft in diesem Dienst UNBEDINGT nach jedem Schreiben (nicht nur im validFrom-verschoben-Zweig) — ein zusaetzliches Sicherheitsnetz gegen bereits bestehende Kettenschaeden, die der einzelne Schreibvorgang fuer sich allein nicht verursacht haette"
    - "Eigene Fehlerklasse pro Aktion (WorkPeriodCorrectionValidationError neben WorkTimeChangeValidationError) macht die serverseitige Trennung zweier fachlich unterschiedlicher Schreibwege auch im Fehlertyp sichtbar, statt sie ueber ein mode-Flag wieder zu vermischen"
    - "Rechenbausteine (PreviewRollback<T>, sumTargetHoursInRange, monthsInRange) werden importiert und wiederverwendet; Validierungstexte/-konstanten (MAX_REASON_LENGTH, containsControlCharacters) werden bewusst lokal dupliziert, weil sie zur Fehlerklasse/Fachlogik der jeweiligen Aktion gehoeren, nicht zu den geteilten Rechenbausteinen"

key-files:
  created:
    - server/src/services/workPeriodCorrectionService.ts
    - server/src/services/workPeriodCorrectionService.test.ts
  modified:
    - server/src/services/workPeriodService.test.ts
    - server/src/services/workPeriodChangeService.test.ts

key-decisions:
  - "checkPeriodChain(userId) laeuft nach JEDEM Schreiben unbedingt (nicht nur im withSuspendedChainGuard-Zweig) — die Task-1-Vorgabe listet den Aufruf als Schritt 7 unconditional nach Schritt 6; das macht den Dienst zugleich robust gegen bereits bestehende Kettenschaeden im Bestand (Nachweis: Test 9)"
  - "Die CR-04-Wertebereichspruefung fuer workSchedule (Struktur UND Tagessumme <= MAX_WEEKLY_HOURS) wurde vollstaendig aus workPeriodChangeService.validateInput() uebernommen, nicht nur die Strukturpruefung, die der Plantext woertlich nannte — dieselbe Umgehungsgefahr (negative Tagessollstunden hebeln die 0-60-Grenze aus) gilt fuer die Korrektur identisch"
  - "previousPeriod im Vorschauergebnis wird bewusst NUR bei tatsaechlich verschobenem validFrom gesetzt (null sonst) — Feldsemantik exakt wie in WorkPeriodCorrectionPreview dokumentiert"

requirements-completed: [REQ-30]

# Metrics
duration: ~45min
completed: 2026-08-22
---

# Phase 13 Plan 03: Stammdaten korrigieren — Korrekturdienst Summary

**`workPeriodCorrectionService.ts` mit `correctWorkPeriod()` — eigener Dienst, eigene Fehlerklasse, rueckwirkende Korrektur bestehender Perioden ueber `updateWorkPeriodValues()`/`setWorkPeriodValidFrom()`/`extendWorkPeriodTo()` statt Split, mit derselben dryRun/Speichern-Rechenbahn und genau einer `model_change`-Journalzeile bei Saldodifferenz.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 neu, 2 geaendert)

## Accomplishments

- `correctWorkPeriod(input, { dryRun, createdBy })` implementiert D1 (eigene Datei, eigene Fehlerklasse `WorkPeriodCorrectionValidationError`, kein `mode`-Parameter), D4/DD-10 (Rebuild-Zeitraum = `min(altes validFrom, neues validFrom)` bis heute, inklusive bereits materialisierter Zukunftsmonate), DD-11 (Verschieben von `validFrom` ueber `withSuspendedChainGuard()` + unmittelbares `checkPeriodChain()`) und DD-12 (Journalbuchung `model_change`, nur bei `balanceDelta !== 0`, mit dem in 13-UI-SPEC vorgegebenen Beschreibungstext)
- Die in 13-01-SUMMARY.md und 13-02-SUMMARY.md wiederholt vertagte DD-2-Zusage ist jetzt eingeloest: `checkPeriodChain()` laeuft innerhalb derselben `db.transaction()`-Klammer, direkt nach dem Schreiben — und zwar **unbedingt**, auch im Zweig ohne Riegel-Aussetzung (weiteres Sicherheitsnetz, T-13-14)
- Alle Meldungstexte woertlich aus 13-UI-SPEC.md uebernommen: Pflichtbegruendung, Wertebereiche, Nachbarschaftsgrenzen, gesperrte erste Periode, „nichts geaendert"
- 11 neue Verhaltenstests (Praefix `test-13-03-`) belegen alle neun im Plan geforderten Faelle inklusive Lueckenschluss in BEIDE Richtungen und Rollback bei einem bereits bestehenden Kettenschaden
- **Kritischer Fund waehrend Task 2:** zwei bestehende Testdateien (`workPeriodService.test.ts`, `workPeriodChangeService.test.ts`) trugen eine woertliche Kopie des INSERT-Guard-Triggers aus der Zeit VOR Migration 013 (ohne `suspended`-Abfrage, ohne `deletedAt`-Filter) und ersetzten den migrierten, korrekten Trigger auf der geteilten `development.db` bei jedem Testlauf dauerhaft durch die veraltete Fassung — behoben (siehe Deviations)

## Task Commits

1. **Task 1: correctWorkPeriod() — eine Rechenbahn fuer Vorschau und Speichern** - `3cb499d` (feat)
2. **Task 2: Tests fuer den Korrekturdienst + Fix fuer veralteten Insert-Guard-Trigger** - `f403ae2` (test)

## Files Created/Modified

- `server/src/services/workPeriodCorrectionService.ts` - `correctWorkPeriod()`, `WorkPeriodCorrectionValidationError`, lokale Validierung (`validateCorrectionInput`)
- `server/src/services/workPeriodCorrectionService.test.ts` - 11 Verhaltenstests, Praefix `test-13-03-`
- `server/src/services/workPeriodService.test.ts` - `INSERT_GUARD_TRIGGER_SQL`-Konstante auf Migration-013-Fassung korrigiert (Rule 1)
- `server/src/services/workPeriodChangeService.test.ts` - dieselbe Korrektur an der dortigen Kopie derselben Konstante (Rule 1)

## Decisions Made

Siehe `key-decisions` im Frontmatter oben. Kernentscheidung: `checkPeriodChain()` laeuft nach JEDEM Schreiben unbedingt, nicht nur im `withSuspendedChainGuard`-Zweig — das war im Plantext nicht explizit ausgeschlossen (Task 1, Schritt 7 folgt unconditional auf Schritt 6) und erhoeht die Robustheit ohne Mehraufwand, da `checkPeriodChain()` ohnehin ein reiner Lesevorgang ist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Veralteter INSERT-Guard-Trigger-Text in zwei bestehenden Testdateien beschaedigte die geteilte development.db dauerhaft**
- **Found during:** Task 2, beim ersten Testlauf von `workPeriodCorrectionService.test.ts` (Test 9, Rollback bei Kettenfehler) — `withSuspendedChainGuard()` schuetzte den absichtlich eingeschleusten Konfliktdatensatz nicht vor dem Insert-Trigger, obwohl der Riegel laut Code korrekt gesetzt war
- **Issue:** `workPeriodService.test.ts` (Test "benennt bei einer per SQL eingeschleusten Luecke...") und `workPeriodChangeService.test.ts` (Test "Bricht die Kettenpruefung nach dem Anlegen der neuen Periode ab...") enthalten je eine lokale Konstante `INSERT_GUARD_TRIGGER_SQL`, die den INSERT-Guard-Trigger kurzzeitig entfernt und sofort wiederherstellt (Technik aus Plan 10-04). Beide Konstanten trugen noch die Fassung aus VOR Migration 013 (ohne `(SELECT suspended FROM work_period_chain_guard WHERE id = 1) = 0`-Abfrage, ohne `deletedAt IS NULL`-Filter). Jeder Testlauf dieser beiden Dateien ersetzte damit den durch Migration 013 korrekt migrierten Trigger auf der geteilten `server/database/development.db` dauerhaft durch die veraltete Fassung — `runMigrations()` haette die Migration nie erneut ausgefuehrt (bereits als angewendet verbucht), sodass der Schaden bis zu dieser Entdeckung unbemerkt jeden nachfolgenden Testlauf und jeden Serverstart gegen dieselbe Datenbank betraf. Damit war `withSuspendedChainGuard()` seit dem ersten Lauf einer dieser beiden Testdateien nach Migration 013 wirkungslos.
- **Fix:** Beide `INSERT_GUARD_TRIGGER_SQL`-Konstanten auf die aktuelle, in `server/src/database/schema.ts` gepflegte Migration-013-Fassung gebracht (mit `suspended`-Abfrage und `deletedAt IS NULL`-Filter in beiden RAISE(ABORT)-Bedingungen). Der bereits beschaedigte Trigger auf der lokalen `development.db` wurde direkt per Skript repariert (`DROP TRIGGER` + `CREATE TRIGGER` mit der korrekten SQL, verifiziert per `sqlite_master`-Abfrage) — kein neuer Migrationslauf noetig, da die Tabellenstruktur selbst unveraendert korrekt war.
- **Files modified:** server/src/services/workPeriodService.test.ts, server/src/services/workPeriodChangeService.test.ts (Code); server/database/development.db (Datenreparatur, kein Code)
- **Verification:** `npx vitest run src/services/workPeriodService.test.ts src/services/workPeriodChangeService.test.ts` — 68/68 gruen; `npx vitest run src/services/workPeriodCorrectionService.test.ts` — 11/11 gruen (insbesondere Test 9, der jetzt tatsaechlich einen echten Kettenschaden erzwingt und den Rollback nachweist); voller Lauf `npx vitest run` — 448 gruen / 3 rot (exakt die drei bekannten Vorbestandsfehler, Baseline aus 13-02-SUMMARY.md unveraendert)
- **Committed in:** f403ae2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bugfix, notwendig fuer eine funktionierende `withSuspendedChainGuard()`-Zusage auf der geteilten Arbeitsdatenbank, nicht nur fuer diesen einen Test)
**Impact on plan:** Der Fund betrifft zwei Dateien ausserhalb des Plan-Scope (`files_modified`), war aber zwingend, um die von T-13-14 geforderte Verhaltensnachweis-Faehigkeit ueberhaupt herzustellen — ohne den Fix haette JEDER kuenftige Testlauf dieser beiden Dateien den korrekten Trigger erneut zerstoert, unabhaengig von diesem Plan. Kein Scope-Creep im Sinne neuer Funktionalitaet, reine Korrektur einer stillen Regression.

## Issues Encountered

Keine ueber die oben dokumentierte Deviation hinaus.

## User Setup Required

None — keine externen Dienste, keine neuen Abhaengigkeiten, keine neue Migration (Migrationen 013/014 liefen bereits in Plan 13-01).

## Next Phase Readiness

- Plan 13-04 (Loeschen) kann `withSuspendedChainGuard()` und das jetzt bewiesene Muster „`checkPeriodChain()` unbedingt nach dem Schreiben, innerhalb derselben Klammer" direkt uebernehmen — die DD-2-Zusage ist fuer beide Schreibwege (Korrigieren, Loeschen) mit diesem Plan technisch nachgewiesen, nicht nur fuer die Korrektur.
- Plan 13-05 (Routen/Rollenpruefung) kann `correctWorkPeriod()` direkt hinter einem neuen Endpunkt (`PUT /:id` bzw. `POST /:id/correct/preview`) verdrahten — Vertrag (`WorkPeriodCorrectionInput/Preview/Outcome`) und Fehlerklasse (`WorkPeriodCorrectionValidationError` → 400, geerbter `WorkPeriodConflictError`-Cause) sind bereits vorhanden und folgen dem Muster aus `workPeriods.ts` (`POST /preview`/`POST /change`).
- Der reparierte INSERT-Guard-Trigger auf `development.db` sollte bei jedem kuenftigen `npm run sync-dev-db` erneut aus der Produktionsdatenbank ueberschrieben werden (dort lief Migration 013 laut 13-01-SUMMARY.md ebenfalls bereits) — kein bekannter Blocker, aber ein Punkt, den Plan 13-05/14 bei einer Verifikation gegen eine frisch synchronisierte development.db im Auge behalten sollte.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle erstellten Dateien verifiziert vorhanden (`workPeriodCorrectionService.ts`,
`workPeriodCorrectionService.test.ts`, dieses SUMMARY.md). Beide Commit-Hashes (`3cb499d`,
`f403ae2`) in `git log --oneline --all` verifiziert.
