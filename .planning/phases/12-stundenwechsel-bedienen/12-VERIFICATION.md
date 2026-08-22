---
phase: 12-stundenwechsel-bedienen
verified: 2026-08-22T17:17:27Z
status: passed
score: 20/20 must-haves verified
overrides_applied: 0
---

# Phase 12: Stundenwechsel bedienen — Verification Report

**Phase Goal:** Ein Admin kann eine Stundenumstellung eintragen und vorher sehen, was sie
bewirkt.
**Verified:** 2026-08-22T17:17:27Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Roadmap Success Criteria (primary contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Eine Umstellung 40→20 zum 01.10. verändert die Überstunden vor dem 01.10. um keine Minute (REQ-28) | ✓ VERIFIED | `server/src/services/workPeriodChangeService.test.ts:172` — Test "REQ-28: Ein Stichtag in der Zukunft laesst jede Buchung davor unveraendert und erzeugt keine model_change-Buchung" — passes (23/23 in this file). D4 also enforced in code: `workPeriodChangeService.ts:501` only books a `model_change` row `if (!options.dryRun && balanceDelta !== 0)`. |
| 2 | Ein rückwirkender Stichtag (Vertrag seit 01.07., eingetragen im September) rechnet ab dem 01.07. neu und lässt davor alles stehen (REQ-26) | ✓ VERIFIED | Test `workPeriodChangeService.test.ts:224` "REQ-26: Ein rueckwirkender Stichtag rechnet ab seinem Datum neu und laesst jede Buchung davor unveraendert" — passes. Rebuild loop (`workPeriodChangeService.ts:454`) iterates only `rebuildMonths` computed from `validFrom`→today (D3). |
| 3 | Die Vorschau zeigt vor dem Speichern denselben Wert, der danach tatsächlich im Konto steht (REQ-27) | ✓ VERIFIED | Test `workPeriodChangeService.test.ts:284` calls `applyWorkTimeChange` once with `dryRun: true` and once with `dryRun: false` on the *same input*, then asserts 7 fields (`targetHoursBefore/After/Delta`, `balanceBefore/After/Delta`, `workingDaysInRange`) are pairwise identical, plus cross-checks `getOvertimeBalance(userId) === saveOutcome.preview.balanceAfter`. Both routes (`server/src/routes/workPeriods.ts:182,267`) call the identical `applyWorkTimeChange()` function — no second, frontend-side calculation exists (`useWorkTimeChange.ts` passes server response through unmodified). |
| 4 | Die Saldodifferenz ist im Kontoauszug als eigene Zeile mit Begründung sichtbar (REQ-29) | ✓ VERIFIED | `desktop/src/components/worktime/OvertimeTransactions.tsx:96,253-285` renders type `model_change` with badge "Modellwechsel", signed `documentedDelta`, reason text and a second line with period reference. Server side: `overtimeLiveCalculationService.ts:476-528` reads `model_change` rows and exposes them with `hours: 0` + `documentedDelta` (post-review invariant: displayed rows sum to displayed balance). Test `workPeriodChangeService.test.ts:363` "REQ-29: Die model_change-Zeile ist im Journal sichtbar, traegt die Begruendung woertlich..." passes. |

### Additional Observable Truths (from PLAN.md frontmatter must_haves, 9 plans)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | `model_change` booking type exists in `overtime_transactions`, tied to the triggering period via `referenceType='work_period'` (D5) | ✓ VERIFIED | `server/src/database/schema.ts:519-523`, `migrations/011_add_model_change_transaction_type.ts`, `migrations/012_fix_reference_type_check_constraint.ts` all declare `'model_change'` in the `type` CHECK and `'work_period'` in `referenceType` CHECK. Dedicated test suite `012_fix_reference_type_check_constraint.test.ts` (5/5 passing) explicitly verifies fresh-DB (`schema.ts`) and migrated-DB constraints are identical, and that `model_change` from Migration 011 survives Migration 012 unchanged. |
| 6 | `GET /api/work-periods` restricts to own periods; foreign `userId` → 403 (D6) | ✓ VERIFIED | `server/src/routes/workPeriods.ts:145-148`: `if (!isAdmin && requestedUserId !== req.session.user!.id) { res.status(403)... }`. |
| 7 | Server↔Desktop contract types exist before any caller is built | ✓ VERIFIED | `server/src/types/index.ts` exports `WorkTimeChangeInput/Preview/PreviewResponse/Outcome`; mirrored in `desktop/src/types/index.ts`. Both `tsc --noEmit` runs clean (see Gates below), confirming type consistency across the boundary. |
| 8 | Dialog opened from within another modal renders visibly above it, not clipped | ✓ VERIFIED | `desktop/src/components/worktime/WorkTimeChangeModal.tsx` renders via `Modal` with `zIndexClass="z-[60]"`, its nested `ConfirmDialog` with `z-[70]`, both `createPortal`-rendered to `document.body` (escapes the `transform` containing block of the parent panel). |
| 9 | ESC closes only the topmost modal | ✓ VERIFIED | `desktop/src/components/ui/useModalLayer.ts:58-73` — ESC handler checks `modalStack.isTopModal(idRef.current)` before calling `onClose`; `modalStack.ts` implements `pushModal/popModal/isTopModal` with an index-guarded stack. |
| 10 | Focus returns to the triggering element on close | ✓ VERIFIED | `useModalLayer.ts:81,98-103` — stores `document.activeElement` on open, restores it in the cleanup function if still attached to the DOM. |
| 11 | No console.log left in `ConfirmDialog.tsx`; console.error/warn preserved elsewhere | ✓ VERIFIED | `grep console.log desktop/src/components/ui/ConfirmDialog.tsx` → 0 hits. |
| 12 | D2: preview and save share exactly one calculation path (`applyWorkTimeChange`) | ✓ VERIFIED | `server/src/services/workPeriodChangeService.ts:303-618` — single exported function, `dryRun` flag only difference; throws `PreviewRollback` to unwind the `db.transaction()` on dry run (rechnen, schreiben, messen, zurückrollen). Both routes call only this function. |
| 13 | D7: period close/create + rebuild + booking run inside one `db.transaction()` | ✓ VERIFIED | `workPeriodChangeService.ts:312` wraps the entire body (`closeWorkPeriod`/`createWorkPeriod`, `checkPeriodChain`, `rebuildOvertimeTransactionsForMonth` loop, `createTransaction`, `audit_log` insert) in a single `db.transaction((): WorkTimeChangeOutcome => {...})`. |
| 14 | previewToken binds `userId, validFrom, weeklyHours, workSchedule` (+ `adminId`, review addition WR-09), stateless HMAC, 15 min TTL, reason explicitly unbound | ✓ VERIFIED | `server/src/services/workTimeChangeToken.ts:53-60,73-76,98-108` — `PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000`; canonical string omits `reason`; `timingSafeEqual` signature check. |
| 15 | Both POST routes require `requireAuth` AND `requireAdmin` (D6) | ✓ VERIFIED | `server/src/routes/workPeriods.ts:172-173` (`/preview`), `:224-225` (`/change`). |
| 16 | Save attempt without a valid previewToken is rejected, cannot bypass validation | ✓ VERIFIED | `workPeriods.ts:233-264` — `verifyPreviewToken()` gate before any call to `applyWorkTimeChange`; returns 409 `PREVIEW_STALE` on failure, writes nothing. |
| 17 | D1: "Stundenwechsel ab Datum …" is its own action/dialog; EditUserModal hours fields are read-only and reference it | ✓ VERIFIED | `desktop/src/components/users/EditUserModal.tsx:332,358,374` — `readOnly` on hours fields with helper text pointing to "Stundenwechsel ab Datum …" button; `WorkTimeChangeModal` rendered as sibling after `</form>`. |
| 18 | Save in EditUserModal can no longer silently overwrite the work-time model | ✓ VERIFIED | Fields are `readOnly` (see above); code review CR-01(desktop)/D1 confirms `weeklyHours`/`workSchedule` flow unmodified from `user` object into the submit payload. |
| 19 | After a saved change, period list and read-only fields immediately reflect the new value (state 15) | ✓ VERIFIED | `desktop/src/pages/UserManagementPage.tsx:42` — `editingUserId` (not a stale object) is held; `EditUserModal` re-derives the user from the live `users` query each render. `useSaveWorkTimeChange` (`useWorkTimeChange.ts:74-77`) invalidates `['work-periods', userId]` and calls `invalidateUserAffectedQueries`. |
| 20 | WR-12 closed: desktop absence preview is period-aware and skips weekends/holidays like the server | ✓ VERIFIED | `desktop/src/utils/timeUtils.ts:219` — interval check `period.validFrom <= date && (period.validTo === null || period.validTo > date)`, character-identical to `resolveWorkPeriodIn()` in `server/src/services/workPeriodService.ts:251`. |

### Required Artifacts

All 20 artifacts declared across the 9 plans exist and are substantive (not stubs):

| Artifact | Lines | Status |
|----------|------:|--------|
| `server/src/database/migrations/011_add_model_change_transaction_type.ts` | 133 | ✓ VERIFIED |
| `server/src/database/migrations/012_fix_reference_type_check_constraint.ts` | 151 | ✓ VERIFIED (not in original plan frontmatter — added during review fix; tested) |
| `server/src/routes/workPeriods.ts` | 305 | ✓ VERIFIED |
| `server/src/services/workPeriodChangeService.ts` | 618 | ✓ VERIFIED |
| `server/src/services/workTimeChangeToken.ts` | 189 | ✓ VERIFIED |
| `server/src/services/workPeriodChangeService.test.ts` | 1165 | ✓ VERIFIED (23/23 tests pass) |
| `desktop/src/components/ui/modalStack.ts` | 44 | ✓ VERIFIED |
| `desktop/src/components/ui/Modal.tsx` | 88 | ✓ VERIFIED |
| `desktop/src/components/ui/ConfirmDialog.tsx` | 112 | ✓ VERIFIED |
| `desktop/src/components/ui/useModalLayer.ts` | 133 | ✓ VERIFIED (extracted during review fix WR-15; shared by Modal + ConfirmDialog) |
| `desktop/src/hooks/useWorkTimeChange.ts` | 80 | ✓ VERIFIED |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` | 183 | ✓ VERIFIED |
| `desktop/src/components/worktime/WorkTimeChangeModal.tsx` | 870 | ✓ VERIFIED (min_lines: 250 required, well exceeded) |
| `desktop/src/components/users/EditUserModal.tsx` | 488 | ✓ VERIFIED |
| `desktop/src/components/users/WorkScheduleEditor.tsx` | 218 | ✓ VERIFIED |
| `desktop/src/pages/UserManagementPage.tsx` | 566 | ✓ VERIFIED |
| `desktop/src/components/worktime/OvertimeTransactions.tsx` | 341 | ✓ VERIFIED |
| `desktop/src/utils/timeUtils.ts` | 352 | ✓ VERIFIED |
| `desktop/src/components/absences/AbsenceRequestForm.tsx` | 407 | ✓ VERIFIED |
| `desktop/src/components/worktime/WorkScheduleDisplay.tsx` | 274 | ✓ VERIFIED |
| `desktop/tests/user-edit.spec.ts` | 298 | ✓ VERIFIED (rewritten test present; not executed — see Human Verification) |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `server/src/server.ts` | `server/src/routes/workPeriods.ts` | `app.use('/api/work-periods', workPeriodsRoutes)` | ✓ WIRED (`server.ts:194`) |
| `server/src/routes/workPeriods.ts` | `server/src/services/workPeriodChangeService.ts` | `applyWorkTimeChange(input, { dryRun, createdBy })` | ✓ WIRED (`workPeriods.ts:182,267`) |
| `server/src/routes/workPeriods.ts` | `server/src/services/workTimeChangeToken.ts` | `issuePreviewToken` / `verifyPreviewToken` | ✓ WIRED (`workPeriods.ts:187,233`) |
| `server/src/services/workPeriodChangeService.ts` | `server/src/services/overtimeTransactionRebuildService.ts` | `rebuildOvertimeTransactionsForMonth` per month in range | ✓ WIRED (`workPeriodChangeService.ts:454`) |
| `server/src/services/workPeriodChangeService.ts` | `overtime_transactions` | `createTransaction(..., type: 'model_change')` | ✓ WIRED (`workPeriodChangeService.ts:517`) |
| `desktop/src/components/ui/Modal.tsx` | `desktop/src/components/ui/modalStack.ts` | `isTopModal` via `useModalLayer` | ✓ WIRED |
| `desktop/src/components/ui/ConfirmDialog.tsx` | `desktop/src/components/ui/modalStack.ts` | `isTopModal` via `useModalLayer` | ✓ WIRED |
| `desktop/src/hooks/useWorkTimeChange.ts` | `/api/work-periods` | `apiClient.get`/`apiClient.post` (wraps `universalFetch`) | ✓ WIRED |
| `desktop/src/components/worktime/WorkTimeChangeModal.tsx` | `desktop/src/hooks/useWorkTimeChange.ts` | `usePreviewWorkTimeChange` + `useSaveWorkTimeChange` | ✓ WIRED |
| `desktop/src/components/users/EditUserModal.tsx` | `desktop/src/components/worktime/WorkTimeChangeModal.tsx` | rendered as sibling after `</form>` | ✓ WIRED |
| `desktop/src/pages/UserManagementPage.tsx` | `desktop/src/components/users/EditUserModal.tsx` | `editingUserId` + `users?.find(...)` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `OvertimeTransactions.tsx` `model_change` row | `documentedDelta` | `overtimeLiveCalculationService.ts` reads `overtime_transactions WHERE type='model_change'` | Real DB query, `hours: 0` for aggregate purposes + `documentedDelta` from actual row `hours` | ✓ FLOWING |
| `WorkTimeChangeModal.tsx` preview panel | `preview.balanceBefore/After/Delta`, `targetHoursBefore/After/Delta` | `usePreviewWorkTimeChange()` → `POST /api/work-periods/preview` → `applyWorkTimeChange(dryRun:true)` → real `getOvertimeBalance()` measurement inside a rolled-back transaction | Real measured values, not static | ✓ FLOWING |
| `WorkTimePeriodList.tsx` | periods list | `useWorkPeriods(userId)` → `GET /api/work-periods` → `getWorkPeriods()` DB query | Real DB query | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| REQ-26 | 12-01,02,03,04,05,06,07,08,09 | Stichtag auch rückwirkend | ✓ SATISFIED | Dedicated passing test, retroactive-rebuild code path, D1/D3 confirmed in code |
| REQ-27 | 12-03,04,05,06,09 | Vorschau vor dem Speichern | ✓ SATISFIED | Same-function preview/save + dedicated pairwise-equality test |
| REQ-28 | 12-03,05,06,09 | Saldo wird nicht umgerechnet | ✓ SATISFIED | Future-date test; no booking on zero delta; explicit UI footnote text present verbatim |
| REQ-29 | 12-01,03,05,07,09 | Differenz als sichtbare Buchung | ✓ SATISFIED | model_change booking, Kontoauszug row with badge/reason/period-reference, dedicated test |

No orphaned requirements found — REQ-26 through REQ-29 (the only IDs mapped to Phase 12 in `.planning/REQUIREMENTS.md`, table row 173-176) are all declared across the 9 plan frontmatters and independently substantiated in code and tests.

### Anti-Patterns Found

None. Scanned all 29 files touched by this phase's 9 plans plus the review-fix-added `useModalLayer.ts` and `012_fix_reference_type_check_constraint.ts` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming soon|not yet implemented`. Zero hits except legitimate uses of the word "placeholder" as a CSS/state-name and HTML `placeholder` attributes, and one historical comment (`UserManagementPage.tsx:137`) describing a *removed* stale TODO — not a live marker. `console.log` count is 0 in all touched files; `console.error`/`console.warn` preserved as required.

### Gate Verification (re-run independently, not taken from SUMMARY claims)

| Gate | Command | Result |
|---|---|---|
| Server TypeScript | `cd server && npx tsc --noEmit` | Exit 0, clean |
| Desktop TypeScript | `cd desktop && npx tsc --noEmit` | Exit 0, clean |
| Server test suite | `cd server && npx vitest run` | 418 passed / 3 failed / 421 total |
| Phase-specific service test | `npx vitest run src/services/workPeriodChangeService.test.ts` | 23/23 passed |
| Migration parity test | `npx vitest run src/database/migrations/012_fix_reference_type_check_constraint.test.ts` | 5/5 passed |

The 3 vitest failures were independently confirmed to be identical in title, file and assertion to the 3 pre-existing failures documented in `.planning/phases/11-datumsabh-ngige-berechnung/11-AUSGANGSZUSTAND.md` (2× `unifiedOvertimeService.test.ts` hire-date regression, 1× `vacationBackfillService.test.ts` "erkennt einen bereits gelaufenen Backfill"). Not a Phase 12 regression.

### Behavioral Spot-Checks

Full HTTP/E2E spot-checks (curl against a running dev server, Playwright execution) were not performed — starting a server/browser session is outside the scope of a fast, non-mutating verification pass, and per the task's `<uat_is_deferred>` instruction this is explicitly deferred to Phase 14's UAT session (already tracked as items 37-39, 48 in `14-UAT-SAMMLUNG.md`). Instead, the phase's own dedicated Vitest suite (`workPeriodChangeService.test.ts`) exercises the full `applyWorkTimeChange()` path end-to-end against a real SQLite test database (dry-run vs. real-write comparison, transaction rollback, audit log, chain validation) — this is a stronger and more precise substitute than a shell-level curl probe would be, and was independently re-run above (23/23 passing).

### Probe Execution

No `scripts/*/tests/probe-*.sh` files or PLAN/SUMMARY-declared probes found for this phase (`find scripts -path '*/tests/probe-*.sh'` → no matches; no probe references in PLAN/SUMMARY files). Step 7c: SKIPPED (no probes declared).

### Human Verification Required

None new. All items that would normally require human/visual/production-copy verification for this phase (dialog visual appearance in light/dark mode, nested-dialog stacking in the real embedding context, keyboard-only operation, focus behavior, contrast measurements, a full Playwright run of `user-edit.spec.ts`, production-copy retroactive-change timing, migration 012 pre-check against real production data) are already explicitly enumerated — 51 numbered items — in `.planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md`, section "Phase 12 — Stundenwechsel bedienen" (points 1-51), per the user's explicit instruction to defer all UAT for this milestone to Phase 14. No item was found during this verification that is both genuinely unverifiable by static/automated means AND missing from that list.

### Gaps Summary

No gaps found. All 4 ROADMAP success criteria and all 20 sampled plan-level must-haves are backed by real, substantive, wired code — not stubs. The two TypeScript gates are clean, the phase-specific test suite (23 tests) and the migration-parity test suite (5 tests) pass, and the 3 pre-existing server test failures were independently confirmed to be unrelated to this phase (same titles/files/assertions as the documented Phase-11 baseline). The post-review invariant explicitly flagged in the task brief — that `model_change` bookings carry `hours: 0` plus a separate `documentedDelta` field and are excluded from every `SUM(hours)` read path so that displayed journal rows sum to the displayed balance — was independently traced through `overtimeTransactionService.ts`, `overtimeTransactionManager.ts`, `overtimeTransactionRebuildService.ts`, and `overtimeLiveCalculationService.ts`, and is covered by a dedicated passing test (`workPeriodChangeService.test.ts:396`, "CR-01: Die model_change-Zeile wird in KEINEM transaktionssummierenden Lesepfad mitgezaehlt"). REQ-26 through REQ-29 are all satisfied.

---

_Verified: 2026-08-22T17:17:27Z_
_Verifier: Claude (gsd-verifier)_
