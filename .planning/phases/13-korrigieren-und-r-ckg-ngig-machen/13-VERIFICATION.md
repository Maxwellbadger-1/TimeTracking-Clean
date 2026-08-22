---
phase: 13-korrigieren-und-r-ckg-ngig-machen
verified: 2026-08-22T22:13:37Z
status: passed
score: 4/4 roadmap success criteria verified (11/11 must-haves across 11 plans)
overrides_applied: 0
---

# Phase 13: Korrigieren und rückgängig machen Verification Report

**Phase Goal:** Ein Fehler beim Eintragen ist heilbar, und die Heilung ist nachvollziehbar.
**Verified:** 2026-08-22T22:13:37Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Eine versehentlich eingetragene Umstellung lässt sich löschen; danach entsprechen die Überstunden exakt dem Stand davor | ✓ VERIFIED | `server/src/services/workPeriodDeletionService.test.ts` — "Zusicherung A/B/C/D" test: creates a real balance via time entries, applies a work-time change, deletes it, asserts `Math.abs(getOvertimeBalance(userId) - saldoVorher) < 0.017` against the **actually computed** balance (not the journal sum). Ran it directly: passes. |
| 2 | Nach dem Löschen zeigt der Auszug Buchung und Storno — nicht eine bereinigte Lücke | ✓ VERIFIED | Same test, Zusicherung C/D: exactly 2 `overtime_transactions` rows survive (original + reversal, `reversalOf` set, opposite `hours`), both `model_change` rows come back from `calculateLiveOvertimeTransactions()` with `hours === 0`. `overtimeLiveCalculationService.test.ts` (15 tests) independently covers the reversal-pair read path (`reversalOf`/`reversedBy`/`reversedAt`/`reversedByName`, shared receipt number). Ran directly: 15/15 pass. |
| 3 | Die Korrektur-Aktion ohne Begründung wird abgewiesen | ✓ VERIFIED | `workPeriodCorrectionService.ts:230-234` throws `WorkPeriodCorrectionValidationError` for missing/`<10`-char reason, enforced in the **service**, not just the route (D7). Same pattern in `workPeriodDeletionService.ts:148/152`. `workPeriodCorrectionService.test.ts` asserts "Begründung muss mindestens 10 Zeichen lang sein". |
| 4 | Ein Mitarbeiter kann die Perioden eines anderen weder sehen noch über die API abrufen | ✓ VERIFIED | All 6 period endpoints (`GET /`, `POST /preview`, `POST /change`, `POST /:id/correct/preview`, `PUT /:id`, `POST /:id/delete/preview`, `DELETE /:id`) carry `requireAuth` + `requireAdmin` in `server/src/routes/workPeriods.ts`. `workPeriods.authorization.test.ts` runs real HTTP requests with an employee session against a foreign `userId` and asserts `403` with no `data` leaking — 13/13 tests pass (ran directly). |

**Score:** 4/4 roadmap success criteria verified.

### Critical Property: `model_change` is arithmetically inert

Verified directly, not merely by re-reading the review:
- `overtimeTransactionManager.createTransaction()` writes the row exactly as given; nothing sums `hours` implicitly.
- Every balance path excludes `model_change`: `overtimeTransactionService.getOvertimeBalance()` reads the `overtime_balance` aggregate (populated purely by the rebuild, not by the journal row); `getOvertimeBalanceAtDate()`/`getOvertimeStatistics()`/12-month history carry `EXCLUDE_JOURNAL_ONLY_TYPES`; `getBalanceBeforeDate()` and `overtimeTransactionRebuildService.getPreviousMonthBalance()` carry `type <> 'model_change'`.
- The live statement (`overtimeLiveCalculationService.ts`) pushes `hours: 0` + a separate, non-summed `documentedDelta` for both the original and the reversal row.
- The non-negotiable guard test exists and passes: `workPeriodDeletionService.test.ts`, "Zusicherung A/B/C/D — Umstellung eintragen, loeschen: der TATSAECHLICH BERECHNETE Saldo…", asserting `Math.abs(getOvertimeBalance(userId) - saldoVorher) < 0.017` against the actually computed balance, plus Zusicherung C which independently asserts both `model_change` rows have `hours === 0` and the live-summed total matches `getOvertimeBalance()`. Ran this test directly (not trusting SUMMARY/REVIEW claims) — it passes.

No double-counting regression found. Phase 12's fixed bug (CR-01 of that phase) stays fixed here.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/database/migrations/013_soft_delete_user_work_periods.ts` | deletedAt/deletedBy, deletedAt-aware triggers, suspendable chain guard | ✓ VERIFIED | Exists, migration + parity test present, `schema.ts` matches (schemaMigrationParity.test.ts passes as part of full suite) |
| `server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.ts` | `reversalOf` self-reference | ✓ VERIFIED | Exists with test |
| `server/src/database/migrations/015_unique_reversal_of_index.ts` | Unique partial index on `reversalOf` (WR-11 fix) | ✓ VERIFIED | Exists, includes pre-flight duplicate check + self-verification; NOT yet applied to `development.db` (by design — `runMigrations()` applies at next start; correctly flagged as UAT item 13-U14, not a code gap) |
| `server/src/services/workPeriodService.ts` | Soft-delete-aware read/write paths, `softDeleteWorkPeriod`, `extendWorkPeriodTo` | ✓ VERIFIED | All 4 UPDATE paths carry `AND deletedAt IS NULL` (WR-12 fix confirmed in code) |
| `server/src/services/workPeriodCorrectionService.ts` | `correctWorkPeriod()` — own service, own error class, dry-run/save via one function | ✓ VERIFIED | CR-01 fix confirmed: journal row now written unconditionally on save (not just when `balanceDelta !== 0`), `hours: balanceDelta` stays arithmetically inert per the critical property. WR-03 null-guard confirmed (no unchecked cast). WR-08 future-month fix confirmed (`rebuildMonths` filtered to `<= currentMonth` plus already-materialized months). |
| `server/src/services/workPeriodDeletionService.ts` | `deleteWorkPeriod()` — soft-delete, gap-closure, rebuild, reversal, one transaction | ✓ VERIFIED | Zusicherung A/B/C/D test passes; WR-03 null-guard confirmed |
| `server/src/services/overtimeTransactionManager.ts` | Duplicate-detection includes `reversalOf` (CR-02 fix) | ✓ VERIFIED | `COALESCE(reversalOf, -1) = COALESCE(?, -1)` added to the WHERE clause; `allowDuplicate` escape hatch added for the correction service's legitimate same-day re-corrections |
| `server/src/routes/workPeriods.ts` | 6 endpoints, each `requireAuth` + `requireAdmin` | ✓ VERIFIED | grep confirms all 6 routes |
| `server/src/routes/workPeriods.authorization.test.ts` | HTTP-level 403 proof | ✓ VERIFIED | 13/13 tests pass |
| `server/src/services/overtimeLiveCalculationService.ts` | Reversal-pair fields in the statement | ✓ VERIFIED | `reversalOf`/`reversedBy`/`reversedAt`/`reversedByName`, shared receipt number; 15/15 tests pass |
| `desktop/src/components/worktime/WorkTimePeriodEditModal.tsx` | Correction dialog, warning banner, mandatory reason, server preview | ✓ VERIFIED | "Das ändert die Vergangenheit" banner present and wired to preview token gating |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` | "Kein Zugriff" 403 state, permanent footnote | ✓ VERIFIED | String present, distinct from empty state |
| `desktop/src/components/users/EditUserModal.tsx` | Correction block, deletion confirmation with server preview | ✓ VERIFIED | "Sonderfall: Die Werte waren von jeher falsch" present |
| `desktop/src/components/worktime/workTimePeriodActions.tsx` | Correct/Delete/hint-chip per row | ✓ VERIFIED | "Nicht löschbar" chip present for first period |
| 4× `desktop/src/components/**/*.check.ts` | Rule verification scripts | ✓ VERIFIED (WR-04 fixed) | `desktop/tsconfig.check.json` created, `npm run check:rules` wires all four scripts into the type-checked + executed pre-commit path; ran directly — 19+16+... tests all PASS |
| `.planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md` | Bundled human-verification items for Phase 13 | ✓ VERIFIED | Phase 11 (numbered 1-6 items, intact), Phase 12 (numbered 1-51, intact), Phase 13 (13-U1..13-U19, 13-F1..13-F10, WR-07 open-item note) and Phase 14 sections all present and undisturbed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `workPeriodCorrectionService.ts` | `overtimeTransactionManager.createTransaction()` | unconditional journal write w/ `hours: balanceDelta`, `allowDuplicate: true` | ✓ WIRED | Confirmed in code, CR-01 + CR-02 fixes present |
| `workPeriodDeletionService.ts` | `workPeriodService.ts` | `softDeleteWorkPeriod` + `extendWorkPeriodTo` | ✓ WIRED | Single soft-delete write path, single gap-closure write path |
| `overtimeLiveCalculationService.ts` | `overtime_transactions.reversalOf` | self-join for `reversedBy` | ✓ WIRED | Unique partial index added (migration 015) to prevent the 1:n duplication risk WR-11 identified |
| `desktop/src/hooks/useWorkTimeChange.ts` | `server/src/routes/workPeriods.ts` | `apiClient` on the 4 correct/delete endpoints | ✓ WIRED | `useCorrectWorkPeriodPreview`, `useCorrectWorkPeriod`, `useDeleteWorkPeriodPreview`, `useDeleteWorkPeriod` present |
| `desktop/src/components/users/EditUserModal.tsx` | `desktop/src/components/worktime/WorkTimePeriodList.tsx` | `renderActions` prop | ✓ WIRED | Confirmed via review file list + check:rules pass |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| REQ-30 | 13-03, 13-05, 13-08, 13-09, 13-11 | "Stammdaten korrigieren" is a separate action with its own warning + mandatory reason | ✓ SATISFIED | `workPeriodCorrectionService.ts` is a standalone service/error-class with no shared mode-flag endpoint; UI warning banner + mandatory ≥10-char reason enforced server-side |
| REQ-31 | 13-01, 13-02, 13-04, 13-05, 13-06, 13-10, 13-11 | Period edit/delete triggers rebuild from its start; correction bookings are reversed, not deleted, reversal history stays visible | ✓ SATISFIED | Zusicherung A/B/C/D test, `overtimeLiveCalculationService` reversal-pair fields, migration 013-015 |

No orphaned requirements — REQUIREMENTS.md maps exactly REQ-30/REQ-31 to Phase 13, and both are claimed and satisfied across the 11 plans.

### Anti-Patterns Found

Debt-marker scan (`TBD`/`FIXME`/`XXX`) on all phase-touched service/route/component files: **none found.**

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/src/services/userService.ts` (pre-existing file, touched by WR-07 partial fix only) | 565-641 | `PUT /api/users/:id` still mirrors `weeklyHours`/`workSchedule` into the open period without preview token, mandatory reason, or journal row | ⚠️ WARNING | API-only bypass path (not reachable from the app's own UI — `EditUserModal.handleSubmit` sends `weeklyHours` unchanged). Explicitly documented as an open item in `PROJECT_STATUS.md` ("Offene Restposten") and in `14-UAT-SAMMLUNG.md` with a request for an explicit accept/reject decision before release. The balance-consistency half of this bug (stale `overtime_balance` rows) IS fixed. This does not break any of the 4 roadmap success criteria (which are scoped to the "Stammdaten korrigieren"/"Periode löschen" actions specifically), but is a documented deviation from D1's spirit ("die Trennung muss auch serverseitig sichtbar sein"). Judged as non-blocking for this phase's goal because the deviation is a pre-existing legacy code path, not something Phase 13 introduced, and it is honestly disclosed rather than hidden. |

No other blocker- or warning-level anti-patterns found in the reviewed files. All 15 review fix commits (2 Critical + 13 Warning) were independently re-verified in the actual code, not merely trusted from `13-REVIEW.md`'s "status: fixed" claim:
- CR-01 (missing journal row on `balanceDelta === 0`) — confirmed fixed in `workPeriodCorrectionService.ts:421-450`.
- CR-02 (`createTransaction()` duplicate-detection missing `reversalOf`, permanently-undeletable periods) — confirmed fixed in `overtimeTransactionManager.ts:78-97` + `allowDuplicate` escape hatch.
- WR-03 (unchecked non-null casts) — confirmed fixed (explicit null-throw, no cast) in both services.
- WR-04 (`.check.ts` scripts not wired) — confirmed fixed via `tsconfig.check.json` + `npm run check:rules`, ran directly: all pass.
- WR-08 (future-month `overtime_balance` rows) — confirmed fixed (`rebuildMonths` bounded to `<= currentMonth` + materialized months).
- WR-09 (client/server day-schedule comparison mismatch) — confirmed fixed, `check:rules` output shows the WR-09-labeled regression tests passing.
- WR-11 (non-unique `reversalOf` index) — confirmed fixed via migration 015.
- WR-12 (UPDATE paths missing `deletedAt IS NULL` guard) — confirmed fixed, all 4 write paths in `workPeriodService.ts` now guarded.
- WR-07 — only partly fixed by design, tracked as an open item (see Anti-Patterns table above).

### Behavioral Spot-Checks / Test Execution

Re-ran (not just re-read SUMMARY/REVIEW claims) the following directly against the actual codebase:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Server typecheck | `cd server && npx tsc --noEmit` | Exit 0 | ✓ PASS |
| Desktop typecheck | `cd desktop && npx tsc --noEmit` | Exit 0 | ✓ PASS |
| Full server test suite | `cd server && npx vitest run` | 486 passed / 3 failed (36 files) | ✓ PASS (matches documented pre-existing baseline exactly: 2× `unifiedOvertimeService.test.ts` hire-date regression, 1× `vacationBackfillService.test.ts` backfill-detection — same titles as `11-AUSGANGSZUSTAND.md`; red count did not grow) |
| Authorization HTTP test | `npx vitest run src/routes/workPeriods.authorization.test.ts` | 13/13 passed | ✓ PASS |
| Deletion/correction/live-calc tests | `npx vitest run workPeriodCorrectionService.test.ts workPeriodDeletionService.test.ts overtimeLiveCalculationService.test.ts` | 37/37 passed | ✓ PASS |
| Desktop rule scripts | `cd desktop && npm run check:rules` | 19 + 16 (+ other check files) all "PASS" | ✓ PASS |

### Probe Execution

No dedicated `scripts/*/tests/probe-*.sh` probes declared for this phase; the phase's own verification mechanism (vitest + `.check.ts` scripts) was executed directly above instead. N/A.

### Human Verification Required

None required to close out this phase. Per `13-CONTEXT.md`'s explicit deferred-scope decision ("Human-Verifikation / UAT dieser Phase — auf Anweisung des Anwenders ans Ende des Milestones gestellt") and the environment constraints for this verification run, all human/visual/live-server checks were deliberately deferred to the Phase 14 UAT session rather than blocking this phase's technical verification. Confirmed those items are actually captured, not lost: `14-UAT-SAMMLUNG.md` contains 19 numbered Phase-13 checks (13-U1..13-U19), 10 documented judgment calls (13-F1..13-F10), and an explicit accept/reject prompt for the WR-07 open item — appended without disturbing the pre-existing Phase 11 and Phase 12 sections.

### Gaps Summary

No blocking gaps. All four ROADMAP success criteria are directly evidenced by tests that were re-run in this verification pass, not merely inferred from documentation. The one open item (WR-07, a pre-existing legacy API bypass path) is honestly disclosed in both `PROJECT_STATUS.md` and `14-UAT-SAMMLUNG.md` with an explicit request for a human accept/reject decision before release — it does not undermine any of the four roadmap truths for this phase and is recorded as a WARNING, not a blocker.

---

_Verified: 2026-08-22T22:13:37Z_
_Verifier: Claude (gsd-verifier)_
