---
phase: 11-datumsabh-ngige-berechnung
plan: 03
subsystem: database
tags: [sqlite, better-sqlite3, user-work-periods, vitest, transaction]

# Dependency graph
requires:
  - phase: 10-perioden-fundament
    provides: "user_work_periods (Migration 008), Bestandsüberführung (Migration 009), workPeriodService.ts (createWorkPeriod, getWorkPeriods, getCurrentWorkPeriod, checkPeriodChain)"
provides:
  - "Jeder über createUser() angelegte Nutzer hat sofort eine offene Arbeitszeitperiode ab hireDate (oder Anlagedatum als Ersatzdatum)"
  - "ensureInitialWorkPeriod(user, createdBy?) — idempotente Nachrüstfunktion für Alt-Nutzer/Seed-Skripte (Plan 11-08)"
  - "updateUser() spiegelt eine weeklyHours-/workSchedule-Änderung atomar in die offene Periode (Übergangsmaßnahme bis Phase 12)"
affects: [11-04, 11-08, 11-09, 12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db.transaction() klammert INSERT INTO users + createWorkPeriod() in createUser() — kein halber Zustand bei Fehler (T-11-09)"
    - "Ersatzdatum-Kette für neue Nutzer (hireDate wohlgeformt sonst Anlagedatum) fortgeschrieben aus Migration 009/D5, ohne das time_entries-Zwischenglied, weil ein neuer Nutzer noch keine Zeiteinträge hat"
    - "vi.spyOn auf den Modul-Namespace (import * as workPeriodService) zum Erzwingen von Fehlerpfaden in Transaktions-Atomaritätstests statt Trigger-Umgehung"

key-files:
  created:
    - server/src/services/userWorkPeriodProvisioning.test.ts
  modified:
    - server/src/services/userService.ts

key-decisions:
  - "createdBy der Startperiode bleibt null bei createUser() (kein Admin-Kontext in der Service-Signatur, Signatur bewusst unverändert laut Acceptance Criteria) — die note trägt die Nachvollziehbarkeit (T-11-10)"
  - "Task 2 schreibt UPDATE user_work_periods direkt in userService.ts statt in workPeriodService.ts, weil Plan 11-02 in derselben Welle an dieser Datei arbeitet — Phase 12 führt den Schreibzugriff zusammen (explizite Plan-Vorgabe)"
  - "Rule 1: createUser() ohne hireDate verletzte die NOT-NULL-Spalte users.hireDate (schema.ts:45) bereits vor diesem Plan — behoben, indem hireDate und die Perioden-validFrom denselben resolveInitialValidFrom()-Ersatzwert teilen statt zwei getrennte Rundungswege zu pflegen"

patterns-established:
  - "Pattern: Eine fehlende offene Periode wird im Update-Pfad über ensureInitialWorkPeriod() nachgezogen statt zu werfen — Sicherheitsnetz für Alt-Nutzer, ohne D4s harten Fehler in der Berechnung selbst aufzuweichen"

requirements-completed: [REQ-23]

# Metrics
duration: 55min
completed: 2026-08-22
---

# Phase 11 Plan 03: Startperiode bei Nutzeranlage und -änderung Summary

**createUser()/updateUser() halten die Arbeitszeitperioden-Kette lückenlos: Startperiode bei Anlage (mit derselben Ersatzdatum-Regel wie Migration 009), Spiegelung von weeklyHours/workSchedule-Änderungen in die offene Periode, beides atomar per db.transaction().**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `ensureInitialWorkPeriod()` exportiert und idempotent — schließt die Lücke, die D4 (Phase 11) sonst zu einem Betriebsausfall bei jedem neuen Mitarbeiter gemacht hätte
- `createUser()` legt Nutzer und Startperiode atomar an (eine `db.transaction()`), inklusive Ersatzdatum-Protokollierung per `logger.info`
- `updateUser()` spiegelt `weeklyHours`/`workSchedule`-Änderungen atomar in die offene Periode, ohne bei unveränderten Werten zu schreiben
- Ein vorbestehender Bug gefunden und behoben: `createUser()` ohne `hireDate` verletzte `users.hireDate NOT NULL` bereits vor diesem Plan
- 14 neue Tests, alle grün; Gesamt-Testsuite unverändert bei 3 vorbestehenden Fehlschlägen (342/345)

## Task Commits

Each task was committed atomically:

1. **Task 1: Startperiode bei der Nutzeranlage** - `1edc69c` (feat)
2. **Task 2: Stammdatenänderung spiegelt in die offene Periode** - `84277dc` (feat)
3. **Bugfix (Rule 1, gefunden während Task 3):** `2083623` (fix)
4. **Task 3: Nachweis, dass die Kette lückenlos bleibt** - `e31b0e8` (test)

**Plan metadata:** siehe finaler Commit dieses Executor-Laufs

## Files Created/Modified
- `server/src/services/userService.ts` - `ensureInitialWorkPeriod()` exportiert, `createUser()` legt Nutzer+Startperiode atomar an, `updateUser()` spiegelt Stammdatenänderungen in die offene Periode, `hireDate`-NOT-NULL-Bug behoben
- `server/src/services/userWorkPeriodProvisioning.test.ts` - 14 Tests: Startperiode (hireDate/Anlagedatum), Atomarität (Anlage + Update), Idempotenz von `ensureInitialWorkPeriod`, Spiegelung, No-Op bei unverändertem Wert, Sicherheitsnetz für Alt-Nutzer ohne Periode, `checkPeriodChain`-Konsistenz, Aufräumnachweis

## Decisions Made
- `createdBy` der bei `createUser()` angelegten Startperiode bleibt `null` (kein Admin-Kontext in der Service-Signatur verfügbar, Signatur bewusst unverändert). Die `note`-Spalte trägt Quelle und Grund, das erfüllt T-11-10 gemeinsam mit dem `logger.info`-Protokoll der Ersatzdatum-Wahl.
- Task 2 schreibt das `UPDATE user_work_periods` direkt in `userService.ts` statt in `workPeriodService.ts` — explizite Plan-Vorgabe, weil Plan 11-02 in derselben Welle parallel an `workPeriodService.ts` arbeitete. Phase 12 führt diesen Schreibzugriff zusammen.
- Der Ersatzdatum-Chain für neue Nutzer verzichtet bewusst auf das `time_entries`-Zwischenglied aus Migration 009: Ein Nutzer, für den `createUser()`/`ensureInitialWorkPeriod()` eine Periode anlegt, hat zu diesem Zeitpunkt noch keine Zeiteinträge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `createUser()` ohne `hireDate` verletzte `users.hireDate NOT NULL`**
- **Found during:** Task 3 (beim Schreiben des Tests „ohne hireDate wird validFrom = heutiges Datum")
- **Issue:** `users.hireDate TEXT NOT NULL DEFAULT (date('now'))` (schema.ts:45). Der ursprüngliche Code band `data.hireDate || null` explizit — ein gebundenes `NULL` überschreibt den `DEFAULT`-Wert nicht und verletzt die NOT-NULL-Constraint. Dieser Fehler existierte bereits vor Plan 11-03 und wäre bei jedem `createUser()`-Aufruf ohne `hireDate` aufgetreten (die Route validiert `hireDate` nicht als Pflichtfeld).
- **Fix:** `hireDate` und die Perioden-`validFrom` teilen jetzt denselben Wert aus `resolveInitialValidFrom()` — eine Quelle statt zweier getrennter Rundungswege für „kein hireDate".
- **Files modified:** `server/src/services/userService.ts`
- **Verification:** Test „ohne hireDate wird validFrom = heutiges Datum, note nennt den Grund" schlug vorher mit `SqliteError: NOT NULL constraint failed: users.hireDate` fehl, ist jetzt grün.
- **Committed in:** `2083623`

---

**Total deviations:** 1 auto-fixed (1 Bug)
**Impact on plan:** Notwendig, um Task 1s eigenes Behavior („Ein Nutzer ohne hireDate bekommt validFrom = heutiges Datum") überhaupt erfüllbar zu machen. Kein Scope Creep — Fix bleibt in derselben Funktion, die dieser Task ohnehin ändert.

## Issues Encountered
- Ein direktes `DELETE FROM user_work_periods WHERE userId = ?` zum Testen des „Alt-Nutzer ohne Periode"-Sicherheitsnetzes wird vom DELETE-Guard-Trigger aus Migration 008 abgewiesen (Nutzer existiert noch, letzte Periode). Gelöst durch einen Testnutzer, der direkt per SQL ohne Periode angelegt wird (Muster aus `workPeriodService.test.ts:createTestUser`), statt den Trigger zu umgehen.
- `vi.spyOn(db, 'prepare')` funktioniert wegen des Proxy-Musters in `connection.ts` nicht zuverlässig (kein `defineProperty`-Trap). Für die Atomaritäts- und No-Op-Nachweise stattdessen `vi.spyOn` auf die stabilen, benannten Exporte von `workPeriodService.ts` (`createWorkPeriod`, `getCurrentWorkPeriod`) verwendet — funktioniert zuverlässig, weil Vite SSR-Imports als Namespace-Zugriffe transpiliert (bereits in `workPeriodContext.test.ts`, Plan 11-02, etabliert).

## User Setup Required
None - keine externe Konfiguration nötig.

## Next Phase Readiness
- REQ-23 (Teilaspekt Nutzeranlage/-änderung) erfüllt: Kein Nutzer entsteht ab jetzt ohne Periode, D4s harter Fehler in Plan 11-04 kann nicht mehr durch neu angelegte Mitarbeiter ausgelöst werden.
- Plan 11-08 (Seed-Skripte) kann `ensureInitialWorkPeriod()` direkt verwenden.
- Plan 11-09 (Desktop-Disposition) hat die vorausgesetzte Spiegelung von Task 2 jetzt tatsächlich im Code.
- Kein Blocker für 11-04/11-08/11-09 aus diesem Plan.

---
*Phase: 11-datumsabh-ngige-berechnung*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle genannten Dateien (`server/src/services/userService.ts`,
`server/src/services/userWorkPeriodProvisioning.test.ts`,
`.planning/phases/11-datumsabh-ngige-berechnung/11-03-SUMMARY.md`) existieren. Alle vier
genannten Commit-Hashes (`1edc69c`, `84277dc`, `2083623`, `e31b0e8`) gefunden in
`git log --oneline --all`.
