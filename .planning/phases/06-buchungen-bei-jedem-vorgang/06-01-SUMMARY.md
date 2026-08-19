---
phase: 06-buchungen-bei-jedem-vorgang
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, vacation, journal, absence]

# Dependency graph
requires:
  - phase: 05-journal-fundament
    provides: vacation_transactions Tabelle + recordVacationTransaction() (synchron, transaktionsfähig)
provides:
  - Genehmigung, Ablehnung eines genehmigten Antrags und Löschung erzeugen je eine
    Journalbuchung — an der einzigen Stelle, die vacation_balance.taken verändert
  - Buchung und Statuswechsel laufen atomar in derselben db.transaction() (approve, reject,
    delete — reject hatte die Klammer bereits seit dem 18.08.)
  - deleteAbsenceRequest kennt und protokolliert den auslösenden Nutzer (deletedBy)
  - 10 Regressionstests, die den auslösenden Fehler (Storno ohne Gegenbuchung) und
    verwandte Fälle abdecken
affects: [07-saldo-aus-buchungen-backfill, 08-kontoauszug]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Buchung sitzt an der Stelle, die den Zähler verändert (updateVacationTaken-Aufrufer),
       nicht bei den drei Vorgangs-Endpunkten — verhindert vergessene Gegenbuchungen strukturell"
    - "db.transaction()-Klammer um Statuswechsel + Buchung bei approve/reject/delete
       (applyApproval / applyRejection / applyDeletion)"

key-files:
  created:
    - server/src/services/absenceVacationBooking.test.ts
  modified:
    - server/src/services/absenceService.ts
    - server/src/routes/absences.ts

key-decisions:
  - "approveAbsenceRequest bekam eine neue db.transaction()-Klammer (applyApproval) um
     Statuswechsel + Buchung — nicht im Plan explizit gefordert, aber notwendig für den
     must_have 'Buchung und Statuswechsel liegen in derselben DB-Transaktion' (Rule 2)"
  - "revertBalancesAfterDeletion bekam einen reason-Parameter ('rejected' | 'deleted') für
     eine anlassgerechte Beschreibung im künftigen Kontoauszug"
  - "createAbsenceRequest (Auto-Genehmigung Krankmeldung) übergibt actorId=null — System-
     Automatismus, betrifft ohnehin nie das Urlaubskonto (nur type='vacation' bucht)"

patterns-established:
  - "Journalbuchung überlebt das Löschen des Antrags absichtlich (referenceId zeigt dann
     ins Leere) — Verlinkung im Kontoauszug ist Phase 8"

requirements-completed: [REQ-05, REQ-15]

# Metrics
duration: ~30min
completed: 2026-08-19
---

# Phase 06 Plan 01: Buchungen bei jedem Vorgang Summary

**Genehmigung, Ablehnung und Löschung eines Urlaubsantrags erzeugen jetzt strukturell
garantiert je eine Journalbuchung — gebucht wird an der einzigen Stelle, die
`vacation_balance.taken` verändert, nicht bei den drei Aufrufern.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-19
- **Tasks:** 4
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `updateBalancesAfterApproval()` und `revertBalancesAfterDeletion()` — die beiden einzigen
  Aufrufer von `updateVacationTaken()` — buchen jetzt selbst ins Journal. Per Konstruktion
  kann `taken` nicht mehr ohne zugehörige Buchung verändert werden.
- Statuswechsel und Buchung laufen für alle drei Vorgänge (Genehmigung, Ablehnung, Löschung)
  atomar in derselben `db.transaction()`.
- `deleteAbsenceRequest` protokolliert jetzt den auslösenden Nutzer.
- 10 Regressionstests bilden exakt den auslösenden Fehler nach (genehmigen → ablehnen ohne
  Gegenbuchung) sowie Doppelbuchung, Löschung, offene Ablehnung, Krankmeldung, unbezahlten
  Urlaub, Überstundenausgleich und Konsistenz taken/Journal nach jedem Einzelschritt.

## Task Commits

Each task was committed atomically:

1. **Task 1: Buchung in updateBalancesAfterApproval und revertBalancesAfterDeletion** - `b772d44` (feat)
2. **Task 2: deleteAbsenceRequest um den Auslöser erweitern** - `20dcf4f` (feat)
3. **Task 3: Löschung eines genehmigten Antrags — Transaktionsklammer** - `f79010f` (feat)
4. **Task 4: Regressionstests für die auslösenden Fehler** - `4f4e238` (test)

**Plan metadata:** _folgt in diesem Commit_ (docs: complete plan)

## Files Created/Modified
- `server/src/services/absenceService.ts` — `updateBalancesAfterApproval`/
  `revertBalancesAfterDeletion` buchen jetzt (nur `type='vacation'`); `approveAbsenceRequest`
  und `deleteAbsenceRequest` laufen in `db.transaction()`; `deleteAbsenceRequest` hat einen
  neuen `deletedBy`-Parameter
- `server/src/routes/absences.ts` — Aufruf von `deleteAbsenceRequest` übergibt
  `req.session.user!.id`
- `server/src/services/absenceVacationBooking.test.ts` — 10 neue Regressionstests

## Decisions Made
- **Transaktionsklammer für `approveAbsenceRequest` ergänzt** (nicht explizit im Plan
  gefordert): Der Plan verlangt als must_have, dass Buchung und Statuswechsel atomar sind.
  Für Ablehnung und Löschung war das bereits vorgesehen/umgesetzt, für Genehmigung fehlte
  die Klammer im ursprünglichen Code — ergänzt analog zu `applyRejection`.
- **`revertBalancesAfterDeletion` mit `reason`-Parameter** statt zwei separaten Funktionen —
  hält die Logik an einer Stelle, die Beschreibung im Journal bleibt trotzdem anlassgerecht
  ("Ablehnung" vs. "Löschung").
- **`actorId=null` bei Auto-Genehmigung von Krankmeldungen** — es gibt keinen menschlichen
  Genehmiger; da `type='sick'` ohnehin nie bucht, ist dies folgenlos, aber semantisch korrekt
  ("System-Automatismus" laut Service-Doku).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] db.transaction()-Klammer in approveAbsenceRequest ergänzt**
- **Found during:** Task 1 (Buchung in updateBalancesAfterApproval)
- **Issue:** Der Plan verlangt als must_have "Buchung und Statuswechsel liegen in derselben
  DB-Transaktion". `rejectAbsenceRequest` hatte diese Klammer bereits (seit 18.08.), Task 3
  ergänzt sie für `deleteAbsenceRequest` — für `approveAbsenceRequest` war im Plan keine
  entsprechende Änderung vorgesehen, obwohl UPDATE-Statuswechsel und Buchung dort ohne
  Klammer als zwei separate, nicht-atomare Statements liefen.
- **Fix:** Statuswechsel, `decrementVacationPending` und `updateBalancesAfterApproval` in
  eine neue `applyApproval = db.transaction(...)` gelegt, analog zu `applyRejection`.
- **Files modified:** `server/src/services/absenceService.ts`
- **Verification:** `npx tsc --noEmit` fehlerfrei; Test 1 und 9 der neuen Testdatei
  bestätigen, dass Genehmigung weiterhin korrekt bucht.
- **Committed in:** `b772d44` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Notwendig, um den explizit im Plan formulierten must_have zu erfüllen.
Kein Scope Creep — reine Atomaritätsgarantie für einen bereits vorhandenen Codepfad.

## Issues Encountered
- Zwei Testfälle (Überstundenausgleich, Konsistenzprüfung) benötigten kleine Anpassungen
  gegenüber der ersten Fassung: `overtime_comp` erfordert vorab ein ausreichendes
  Überstundenguthaben (sonst wirft bereits `createAbsenceRequest`), und der direkte
  `toBe(-journal)`-Vergleich schlug bei `+0`/`-0` fehl (JS-Fließkomma-Eigenheit bei
  `Object.is`-basiertem `toBe`). Beides in der Testdatei selbst behoben (Setup ergänzt bzw.
  auf Summenvergleich `taken + journal === 0` umgestellt), kein Produktivcode betroffen.
- Ein einzelner Testlauf der Gesamtsuite zeigte einen dritten, zusätzlichen Fehlschlag
  ("database is locked") in `vacationTransactionService.test.ts` — bei zwei
  Wiederholungsläufen trat er nicht mehr auf. Flüchtige SQLite-WAL-Lock-Kontention durch
  parallele Vitest-Worker, keine Regression durch diesen Plan (bestätigt: 118 grün / 2
  vorbestehend rot, stabil über zwei Wiederholungen).

## User Setup Required

None - keine externe Konfiguration erforderlich.

## Next Phase Readiness
- Journal und `vacation_balance.taken` laufen jetzt für jeden Vorgang parallel und wurden in
  10 Tests gegeneinander verifiziert — Grundlage für Phase 7, die `taken` zur abgeleiteten
  Größe macht.
- Kein Backfill in diesem Plan: Das Journal enthält ab jetzt nur neue Vorgänge, Altdaten
  bleiben Phase 7 vorbehalten.
- Zwei vorbestehende, unveränderte Fehlschläge in `unifiedOvertimeService.test.ts`
  (datumsabhängige Regressionstests, nicht Gegenstand dieses Plans).

---
*Phase: 06-buchungen-bei-jedem-vorgang*
*Completed: 2026-08-19*
