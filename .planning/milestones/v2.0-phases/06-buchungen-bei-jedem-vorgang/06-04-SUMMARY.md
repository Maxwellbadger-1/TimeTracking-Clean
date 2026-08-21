---
phase: 06-buchungen-bei-jedem-vorgang
plan: 04
subsystem: vacation-balance
tags: [sqlite, better-sqlite3, typescript, vitest, vacation, entitlement, pro-rata]

# Dependency graph
requires:
  - phase: 06-buchungen-bei-jedem-vorgang
    provides: "calculateCarryover(previousBalance) als einzige Übertragsquelle (06-06, Welle 1) — initializeVacationBalance() nutzt sie bereits für den Übertrag, unverändert von diesem Plan"
provides:
  - "initializeVacationBalance() (absenceService.ts) delegiert an vacationBalanceService.upsertVacationBalance() — bucht Anspruch/Übertrag atomar in derselben db.transaction(), in der die vacation_balance-Zeile angelegt wird (schließt Gap 1 / CR-02 aus 06-VERIFICATION.md)"
  - "initializeVacationBalance() berechnet den Anspruch über calculateProRataVacationDays(hireDate, vacationDaysPerYear, year) statt den vollen Jahreswert unabhängig vom Eintrittsdatum zu buchen (Koordinator-Zusatzbefund)"
  - "Vier neue Regressionstests in absenceVacationBooking.test.ts: Gap 1 (Auto-Init bucht sofort), zwei Pro-rata-Grenzfälle (unterjähriger Eintritt, Eintritt nach dem angefragten Jahr), Gap 3 / REQ-15 (jahresübergreifender Antrag, dokumentiert unverändertes Verhalten)"
affects: ["06-05", "07-*"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Kontoanlage-Pfade delegieren ausnahmslos an die eine buchende Funktion (upsertVacationBalance), keine parallelen rohen INSERT/UPDATE-Pfade auf vacation_balance mehr"]

key-files:
  created: []
  modified:
    - server/src/services/absenceService.ts
    - server/src/services/absenceVacationBooking.test.ts

key-decisions:
  - "Bestehende, bereits falsch berechnete 2025er-Konten (Karin Jochem, Christine Glas, Test Test, System Administrator) bleiben unverändert — dieser Plan verhindert nur, dass der Fehler ab jetzt weiter auftritt und neu ins Journal gebucht wird; die Korrektur der Bestandsdaten ist eine separate, offene Anwenderentscheidung"
  - "Test 11 (jahresübergreifender Antrag, REQ-15) dokumentiert das bekannte, laut ROADMAP.md bewusst nicht behobene Verhalten (Buchung fällt vollständig ins Startjahr) — kein Verhaltens-Fix in diesem Plan"

patterns-established:
  - "Ein zweiter, konkurrierender Kontoanlage-Pfad neben dem eigentlich buchenden Pfad ist ein Blocker-Anti-Pattern (siehe 06-VERIFICATION.md CR-02) — jede Funktion, die eine vacation_balance-Zeile anlegt, muss durch dieselbe Buchungsfunktion (upsertVacationBalance) laufen"

requirements-completed: ["REQ-07", "REQ-15"]

# Metrics
duration: ~25min
completed: 2026-08-21
---

# Phase 06 Plan 04: initializeVacationBalance() bucht pro-rata und schließt Gap 1/Gap 3 Summary

**initializeVacationBalance() delegiert jetzt an upsertVacationBalance() (atomare Buchung) und berechnet den Anspruch über calculateProRataVacationDays() statt des vollen Jahreswerts — verhindert, dass der Auto-Init-/Anzeige-Pfad (hasEnoughVacationDays, GET /vacation-balance/:year) weiterhin ungebuchte und fachlich falsch berechnete Urlaubskonten anlegt.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-21T~19:05:00Z
- **Completed:** 2026-08-21T19:31:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- `initializeVacationBalance()` liest jetzt zusätzlich `hireDate` und berechnet den Anspruch über `calculateProRataVacationDays(hireDate, vacationDaysPerYear, year)` — dieselbe Funktion, die `initializeVacationAccountsForNewUser()` und `bulkInitializeVacationBalances()` bereits nutzen. Kein voller Jahreswert mehr unabhängig vom Eintrittsdatum.
- Die rohe `INSERT INTO vacation_balance ... ON CONFLICT ... DO UPDATE`-Query wurde vollständig durch einen Aufruf von `upsertVacationBalance({ userId, year, entitlement, carryover, actorId: null })` ersetzt — Kontoanlage und Journalbuchung laufen jetzt atomar in derselben `db.transaction()`.
- Schließt Gap 1 (CR-02, 06-VERIFICATION.md): Konten, die über `hasEnoughVacationDays()` (Auto-Init bei Urlaubsantrag) oder `GET /api/absences/vacation-balance/:year` (bloßes Ansehen) entstehen, sind jetzt sofort gebucht, nicht erst nach der nächsten Genehmigung.
- Schließt den Koordinator-Zusatzbefund: Verhindert, dass ab sofort wieder falsch berechnete (voller statt anteiliger Anspruch) Journalbuchungen entstehen — genau das Muster, das die realen 2025er-Artefakte (Karin Jochem 7 Tage, Christine Glas 13 Tage) erzeugt hat.
- Vier neue Regressionstests in `absenceVacationBooking.test.ts` (10 bestehende + 4 neue = 14/14 grün): Test 10 (Gap 1, Auto-Init bucht sofort), Test 11 (Gap 3 / REQ-15, jahresübergreifender Antrag, dokumentiert unverändertes Verhalten), Test 12 (unterjähriger Eintritt, Pro-rata statt voll), Test 13 (Eintritt nach dem angefragten Jahr, entitlement=0, keine Buchung — reproduziert den realen Produktionsfehler).

## Task Commits

Jeder Task wurde atomar committet:

1. **Task 1: initializeVacationBalance() an den buchenden Pfad delegieren und Anspruch pro rata berechnen** - `a0e2c56` (fix)
2. **Task 2: Regressionstests für Gap 1, den Pro-rata-Zusatzbefund und Gap 3** - `db80fbb` (test)

_Keine separate Plan-Metadaten-Commit — SUMMARY.md wird in diesem Worktree-Lauf zusammen mit den Task-Commits committet (Worktree-Modus, STATE.md/ROADMAP.md werden vom Orchestrator nach der Welle aktualisiert)._

## Files Created/Modified
- `server/src/services/absenceService.ts` - `initializeVacationBalance()` liest `hireDate`, berechnet den Anspruch über `calculateProRataVacationDays()` und delegiert die Kontoanlage an `upsertVacationBalance()` statt rohes SQL zu fahren
- `server/src/services/absenceVacationBooking.test.ts` - vier neue Tests (10-13) für Gap 1, die beiden Pro-rata-Grenzfälle und Gap 3 (REQ-15)

## Decisions Made
- Bestehende, bereits falsch berechnete 2025er-Konten (Karin Jochem, Christine Glas, Test Test, System Administrator) bleiben von diesem Plan unverändert — Korrektur der Bestandsdaten ist eine separate, offene Anwenderentscheidung, kein Korrekturskript in diesem Plan
- Test 11 dokumentiert das bekannte, bewusst nicht behobene REQ-15-Verhalten (jahresübergreifender Antrag bucht vollständig ins Startjahr), ohne es zu verändern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 11 musste nach Buchungstyp filtern statt die Jahressumme zu bilden**
- **Found during:** Task 2, erster Testlauf von Test 11
- **Issue:** Der ursprüngliche Testentwurf summierte alle Journalbuchungen für das Jahr 2090 und erwartete `-request.days`. Da Jahr 2090 für den Testnutzer zuvor unbenutzt war, löste die Genehmigung zusätzlich zur `vacation_taken`-Buchung auch den Auto-Init-Anspruch aus Gap 1 (Test 10) aus — die Jahressumme enthielt also zusätzlich `+30` Tage Anspruch (Summe 25 statt erwarteter -5).
- **Fix:** Assertion filtert jetzt gezielt nach `type === 'vacation_taken'` statt die Jahressumme zu bilden — testet damit exakt das, was Gap 3/REQ-15 verlangt (die Verbrauchsbuchung fällt vollständig ins Startjahr), unabhängig vom Auto-Init-Anspruch desselben Jahres.
- **Files modified:** server/src/services/absenceVacationBooking.test.ts
- **Verification:** `npx vitest run absenceVacationBooking` — 14/14 grün
- **Committed in:** db80fbb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Bug in einer neuen Testassertion, kein Deviation am Produktionscode)
**Impact on plan:** Kein Scope Creep — reine Korrektur einer Testerwartung, die die tatsächliche (korrekte) Interaktion zwischen Gap-1-Fix und Gap-3-Test nicht berücksichtigt hatte.

## Issues Encountered

**Umgebungsbedingter Testfehlschlag außerhalb des Plan-Scopes, während der Arbeit selbstheilend:**

Beim ersten Lauf von `npx vitest run absenceVacationBooking` schlug Test 7b ("Überstundenausgleich — keine Urlaubsbuchung", nicht Teil dieses Plans, bereits vor 06-04 bestehend) mit `SqliteError: no such column: position` fehl. Root Cause: Die lokale `server/database/development.db` hatte die `position`-Spalte der `users`-Tabelle noch nicht über die in `schema.ts` definierte idempotente Migration erhalten (das Skript, mit dem der Orchestrator die Baseline gemessen hatte, hatte offenbar in einer anderen Prozessinstanz gelaufen, die die Migration bereits angewendet hatte). Ein einmaliger, isolierter Aufruf des DB-Connection-Moduls (`initializeDatabase()`, außerhalb des Testlaufs) wendete die Migration an; danach lief Test 7b grün. Kein Code in `files_modified` dieses Plans betroffen — die Migration existiert bereits in `schema.ts` und lief nur noch nicht gegen diese lokale Kopie. Kein Eintrag in `deferred-items.md` nötig, da das Problem sich durch den ohnehin bei jedem Serverstart laufenden, idempotenten Migrationscode selbst behebt.

**Verifikation des Regressionsmaßstabs (Zero-Hallucination-Anforderung aus CLAUDE.md):** Um auszuschließen, dass die Buchungs-Delegation aus Task 1 neue Fehlschläge in der Gesamtsuite verursacht, wurden beide geänderten Dateien per `git checkout 68a47e7f -- <2 Dateien>` temporär auf den Basis-Zustand (vor diesem Plan) zurückgesetzt, die volle Suite lief (`npx vitest run`, sequentiell dank `fileParallelism: false`): identische 18 Fehlschläge (`balanceTracking.test.ts` 7×, `overtimeTransactionCentralization.test.ts` 3×, `unifiedOvertimeService.test.ts` 2×, `workingDays.test.ts` 6×) bei 164/182 grün. Danach wurden beide Dateien per `git checkout HEAD -- <2 Dateien>` wiederhergestellt und Task 2 (das dabei versehentlich mitgelöscht wurde, da es zum Zeitpunkt des Checkouts noch uncommitted war) erneut angewendet und committet. Nach Wiederherstellung: identische 18 Fehlschläge bei 168/186 grün (182 Basis + 4 neue Tests aus diesem Plan, alle 4 grün) — **keiner der 18 vorbestehenden Fehlschläge liegt in einer von diesem Plan geänderten Datei; kein neuer Fehlschlag hinzugekommen.**

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `initializeVacationBalance()` ist jetzt der letzte der drei aus 06-VERIFICATION.md dokumentierten Kontoanlage-Pfade, der konsequent über `upsertVacationBalance()` bucht — die Kerninvariante der Phase ("Journal-Saldo und vacation_balance stimmen nach jedem Vorgang überein") gilt jetzt auch für den Auto-Init-/Anzeige-Pfad.
- Bestehende, bereits falsch gebuchte 2025er-Konten (Karin Jochem, Christine Glas, Test Test, System Administrator) bleiben unverändert — eine separate Korrektur (Gegenbuchung, da das Journal append-only ist) ist eine offene, eigenständige Entscheidung des Anwenders, kein Blocker für 06-05 oder Phase 7.
- Test 11 (REQ-15) hält das bekannte, bewusst nicht behobene Verhalten des jahresübergreifenden Antrags fest — Phase 7 (Saldo aus Buchungen + Backfill) kann darauf aufbauen, ohne dieses Verhalten selbst ändern zu müssen.
- Kein Einfluss auf `server/vitest.config.ts` oder `STATE.md`/`ROADMAP.md` — beide bleiben unverändert, wie vom Orchestrator vorgegeben (Wave-Abschluss aktualisiert diese Dateien separat).

---
*Phase: 06-buchungen-bei-jedem-vorgang*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: server/src/services/absenceService.ts
- FOUND: server/src/services/absenceVacationBooking.test.ts
- FOUND: commit a0e2c56 (Task 1)
- FOUND: commit db80fbb (Task 2)
