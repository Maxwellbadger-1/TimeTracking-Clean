---
status: awaiting_human_verify
trigger: "overtime-validation-backend-mismatch"
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Focus

hypothesis: getOvertimeBalance() in overtimeTransactionService.ts has NO month filter, sums ALL months including future months with negative balances from approved vacation entries
test: Read both functions and compare SQL queries
expecting: getOvertimeBalance uses unfiltered query; getOvertimeSummary has correct month <= endMonth filter
next_action: Fix getOvertimeBalance() to filter out future months (month <= current month)

## Symptoms

expected: Carmen can submit Überstundenausgleich. Frontend shows +5:29h available. Backend should approve.
actual: Frontend shows +5:29h but backend rejects with "Insufficient overtime hours (need 4h, have -66.51h)"
errors: "Insufficient overtime hours (need 4h, have -66.51h)"
reproduction: Carmen Rothemund (userId: 17) submits overtime_comp absence for 13.04.2026 (4h required)
started: Bug persists after previous fix to getOvertimeSummary() — different code path was missed

## Eliminated

- hypothesis: getOvertimeSummary() was not filtering future months
  evidence: Line 633 of overtimeService.ts has "AND month <= ?" + endMonth — fix was applied
  timestamp: 2026-04-08

## Evidence

- timestamp: 2026-04-08
  checked: absenceService.ts line 550
  found: overtime_comp validation calls getOvertimeBalance(data.userId) from overtimeTransactionService.ts
  implication: This is the unfixed code path — NOT getOvertimeSummary()

- timestamp: 2026-04-08
  checked: overtimeTransactionService.ts line 406-417
  found: getOvertimeBalance() SQL = "SELECT COALESCE(SUM(actualHours - targetHours), 0) FROM overtime_balance WHERE userId = ?" — NO month filter
  implication: Sums ALL months including May/June 2026 future entries with large negative balances from approved vacation

- timestamp: 2026-04-08
  checked: overtimeService.ts line 629-636
  found: getOvertimeSummary() SQL has "AND month <= ?" with endMonth = current month — FIXED correctly
  implication: Frontend display uses getOvertimeSummary() (fixed), backend validation uses getOvertimeBalance() (unfixed)

- timestamp: 2026-04-08
  checked: prior investigation data
  found: Carmen's overtime_balance: May 2026 = -32h, June 2026 = -40h due to approved future vacation. Correct balance Jan-Apr = +9.29h.
  implication: -66.51h = sum including future months; fix must add month <= current_month filter to getOvertimeBalance()

- timestamp: 2026-04-08
  checked: live database query for userId=17
  found: SUM all months = -64.11h; SUM month <= 2026-04 = +7.89h
  implication: Fix is confirmed correct — after filtering future months Carmen has +7.89h (enough for 4h request)

- timestamp: 2026-04-08
  checked: TypeScript compilation after fix
  found: npx tsc --noEmit exits 0 — no type errors
  implication: Fix is syntactically clean

## Resolution

root_cause: getOvertimeBalance() in overtimeTransactionService.ts queries overtime_balance with no month filter, summing future months (May/June 2026) that have large negative balances from Carmen's approved future vacation. This gives -66.51h instead of the correct +5.29h. The previous fix was only applied to getOvertimeSummary() (used by frontend display), not to getOvertimeBalance() (used by absence request validation).

fix: Add "AND month <= strftime('%Y-%m', 'now')" to the SQL query in getOvertimeBalance() to exclude future months from the balance calculation.

verification: TypeScript passes (exit 0). Database query confirms: filtered balance (month <= 2026-04) = +7.89h vs unfiltered = -64.11h. Awaiting user confirmation that Carmen can now submit the request.
files_changed: [server/src/services/overtimeTransactionService.ts]
