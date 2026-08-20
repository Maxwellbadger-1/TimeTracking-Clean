---
phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
plan: 01
subsystem: api

tags: [express, better-sqlite3, vitest, authorization, idor]

# Dependency graph
requires:
  - phase: 07-saldo-aus-buchungen-backfill
    provides: vollständiges vacation_transactions-Journal (52 Buchungen, taken aus Journal synchronisiert)
provides:
  - "GET /api/vacation-transactions — Kontoauszug (Journal + Saldo) mit serverseitiger Rollenprüfung"
  - "getVacationJournalEntries / getVacationAccountStatement in vacationTransactionService.ts"
  - "Eigentümerprüfung an GET /api/vacation-balances/:userId (bestehende IDOR-Lücke geschlossen)"
affects: [08-02, 08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rollenprüfung sitzt in der Route (nicht im Service): Nicht-Admin mit fremder userId -> sofort 403, kein stiller Rückfall auf die eigene Id"
    - "LEFT JOIN absence_requests statt JOIN, damit ein gelöschter Antrag die Journalzeile nicht verschluckt (absence: null)"
    - "HTTP-Autorisierungstests über echten express()-Server + app.listen(0) + globales fetch, ohne supertest-Abhängigkeit"

key-files:
  created:
    - server/src/routes/vacationTransactions.ts
    - server/src/routes/vacationTransactionRoutes.test.ts
  modified:
    - server/src/services/vacationTransactionService.ts
    - server/src/services/vacationTransactionService.test.ts
    - server/src/routes/vacationBalance.ts
    - server/src/server.ts

key-decisions:
  - "available wird aus vacation_balance (entitlement+carryover-taken) berechnet, nicht aus dem Journal — beide sind per syncTakenFromJournal-Invariante identisch; journalBalance wird zusätzlich ausgewiesen, damit eine künftige Abweichung im Auszug selbst sichtbar würde"
  - "limit: Standard 200, harte Obergrenze 500 (Werte darüber werden gekappt, ungültige auf 200 zurückgesetzt) — verhindert unbegrenzte Journal-Abfragen"
  - "Eigentümerprüfung an vacation-balances/:userId wurde nachgerüstet statt nur der neuen Route hinzugefügt — sonst wäre REQ-14 nur für das Journal erfüllt, während derselbe Kontostand über den älteren Endpunkt weiter offen läge"

patterns-established:
  - "Explizite 403 statt stillem Rückfall auf die eigene userId bei Rollenprüfungen — ein fremder Zugriffsversuch muss als Fehler sichtbar werden (Gegenmuster zu overtime.ts /transactions)"

requirements-completed: [REQ-11, REQ-12, REQ-13, REQ-14]

# Metrics
duration: ~15min
completed: 2026-08-20
---

# Phase 08 Plan 01: Kontoauszug-Backend (Journal-Endpunkt + Rollenprüfung) Summary

**`GET /api/vacation-transactions` liefert Journal + Saldo mit serverseitiger Rollenprüfung; die bestehende IDOR-Lücke an `GET /api/vacation-balances/:userId` ist geschlossen.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-20
- **Tasks:** 3/3
- **Files modified:** 6 (2 neu, 4 geändert)

## Accomplishments
- Journal-Leseschicht (`getVacationJournalEntries`, `getVacationAccountStatement`) liest Buchungen inklusive verknüpftem Abwesenheitsantrag über `LEFT JOIN absence_requests` — ein gelöschter Antrag lässt die Buchung sichtbar, `absence` wird dann `null`
- Neuer Endpunkt `GET /api/vacation-transactions`: eigenes Konto für Mitarbeiter, jedes Konto für Admins (mit Jahresfilter), harte Rollenprüfung ohne stillen Fallback
- Bestehende Lücke geschlossen: `GET /api/vacation-balances/:userId` gab bisher jedem angemeldeten Nutzer jedes fremde Konto — jetzt 403 für Nicht-Eigentümer
- 11 HTTP-Autorisierungstests (kein neues npm-Paket) belegen beide 403-Fälle end-to-end über echtes HTTP

## Task Commits

Each task was committed atomically:

1. **Task 1: Journal-Leseschicht mit Antragsverknüpfung und Kontostand** - `76f8589` (feat, tdd)
2. **Task 2: Journal-Endpunkt und Absicherung des Kontostand-Endpunkts** - `f8e5383` (feat)
3. **Task 3: HTTP-Autorisierungstests gegen die gemounteten Routen** - `129d004` (test)

_Kein separater Plan-Metadaten-Commit — dieser Plan lief als Worktree-Agent; der Orchestrator committet SUMMARY.md nach dem Merge zentral._

## Files Created/Modified
- `server/src/services/vacationTransactionService.ts` - `getVacationJournalEntries` (LEFT JOIN auf absence_requests) und `getVacationAccountStatement` (Kontoauszug mit Saldo-Invariante) ergänzt
- `server/src/services/vacationTransactionService.test.ts` - Testgruppe `Kontoauszug` mit 9 Fällen ergänzt (25 Tests insgesamt, vorher 16)
- `server/src/routes/vacationTransactions.ts` - Neu: `GET /` mit `requireAuth`, Rollenprüfung, Jahres-/Limit-Parametern
- `server/src/routes/vacationTransactionRoutes.test.ts` - Neu: 11 HTTP-Autorisierungstests gegen die gemounteten Router
- `server/src/routes/vacationBalance.ts` - Eigentümerprüfung an `GET /:userId` ergänzt, Debug-`console.log` mit Kontodaten entfernt
- `server/src/server.ts` - Import + Mount von `vacationTransactionRoutes` auf `/api/vacation-transactions`

## Decisions Made
- `available` bewusst aus `vacation_balance` berechnet statt aus dem Journal, siehe `key-decisions` oben — Journal-Saldo wird als `journalBalance` zusätzlich ausgewiesen, damit eine Abweichung sichtbar bliebe, statt verschleiert zu werden
- `limit`-Parameter: Standard 200, Obergrenze 500, ungültige Eingaben fallen auf den Standard zurück (nicht auf einen Fehler) — konsistent mit dem bestehenden Muster in `overtime.ts`
- Testdaten in Task 3 verwenden `referenceType: 'system'` für die Anspruchsbuchung von employeeB, damit derselbe Datensatz sowohl den REQ-13-Test (absence vs. kein absence) als auch die übrigen Tests bedient, ohne zusätzliche Buchungen anzulegen

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend-Endpunkt und Autorisierung stehen für die Frontend-Anbindung (Plan 08-03, `desktop/src/**`) bereit
- Manuelle Gegenprobe gegen den lokalen Dev-Server ist laut Plan bewusst nicht Teil dieses Plans — sie erfolgt im Human-Verify-Checkpoint von Plan 08-04
- Keine Blocker; alle 36 Server-Tests (25 Service + 11 Route) grün, `npx tsc --noEmit` fehlerfrei, `server/package.json`/`package-lock.json` unverändert

---
*Phase: 08-kontoauszug-f-r-mitarbeiter-und-admin*
*Completed: 2026-08-20*

## Self-Check: PASSED

- Alle 6 Code-Dateien plus SUMMARY.md auf der Festplatte gefunden
- Alle 3 Task-Commits (`76f8589`, `f8e5383`, `129d004`) in `git log --oneline --all` gefunden
