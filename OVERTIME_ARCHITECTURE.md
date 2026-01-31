# Overtime Calculation Architecture - Complete Analysis

**Document Version:** 1.0
**Date:** 2026-01-24
**Author:** System Analysis (Claude Code)
**Status:** 🔴 CRITICAL - Architecture Problem Identified

---

## 🎯 Executive Summary

**CRITICAL FINDING:** The TimeTracking system has **TWO PARALLEL** overtime calculation systems running simultaneously, producing **INCONSISTENT RESULTS**.

**Impact:** Users see different overtime values depending on which UI component they use.

**Example (User 155 "Test Workflow"):**
- Dashboard Widget: **-7:30h** ❌ WRONG (using legacy monthly aggregation)
- Reports Page: **+57:30h** ✅ CORRECT (using new transaction-based system)
- **Difference: 64 hours!**

**Root Cause:** Legacy monthly aggregation system loses granular data (weekend work, daily precision).

**Urgency:** HIGH - Affects payroll accuracy and user trust

---

## 📊 THE TWO SYSTEMS

### System 1: LEGACY (overtime_balance table)

**Database Table:** `overtime_balance`

**Columns:**
```sql
- month TEXT (YYYY-MM)
- userId INTEGER
- targetHours REAL
- actualHours REAL
- overtime REAL
- carryoverFromPreviousYear REAL
```

**Calculation Method:**
```
Monthly Aggregation:
overtime = totalActualHours - totalTargetHours

Where:
- totalActualHours = SUM(worked_hours) + SUM(absence_credits)
- totalTargetHours = SUM(daily_targets) based on workSchedule
```

**Problems:**
1. ❌ **Loses granular data** - Doesn't track which day overtime was earned
2. ❌ **Weekend work undercounted** - Aggregation doesn't properly handle 0-hour target days
3. ❌ **No audit trail** - Can't explain how overtime changed over time
4. ❌ **Corrections not visible** - Manual adjustments hidden in monthly total

**Files Using This System:**
- `server/src/services/overtimeService.ts` (main logic)
- `server/src/routes/overtime.ts` (legacy endpoints)
- `server/src/services/timeEntryService.ts` (calls updateMonthlyOvertime)

---

### System 2: NEW (overtime_transactions table)

**Database Table:** `overtime_transactions`

**Columns:**
```sql
- date TEXT (YYYY-MM-DD)
- userId INTEGER
- type TEXT (earned | compensation | correction | carryover)
- hours REAL
- description TEXT
- createdAt TEXT
```

**Calculation Method:**
```
Transaction-Based (like a bank account):
balance = SUM(all_transactions)

Where transactions are created for:
- earned: Daily (actual - target) for each day worked
- compensation: Vacation/sick days taken (-hours)
- correction: Manual admin adjustments
- carryover: Year-end rollover
```

**Benefits:**
1. ✅ **Perfect audit trail** - Every hour change is logged
2. ✅ **Accurate to the minute** - Daily precision, not monthly
3. ✅ **Weekend work counted correctly** - Each day calculated individually
4. ✅ **Transparent corrections** - Admin adjustments visible in history

**Files Using This System:**
- `server/src/services/overtimeTransactionService.ts` (main logic)
- `server/src/services/reportService.ts` (uses transactions preferentially)
- `server/src/scripts/migrateOvertimeToTransactions.ts` (migration)

---

## 🔌 ALL API ENDPOINTS

### Group A: LEGACY Endpoints (using overtime_balance)

#### 1. GET /api/overtime/balance
- **Function:** `getOvertimeBalanceLEGACY(userId, year)`
- **Returns:** Array of monthly balance entries
- **Used by:** Unknown (possibly deprecated)
- **Status:** ⚠️ @deprecated (marked in code comments)

#### 2. GET /api/overtime/month/:userId/:month
- **Function:** `getOvertimeByMonth(userId, month)`
- **Returns:** Single month balance `{month, targetHours, actualHours, overtime}`
- **Used by:** Unknown
- **Status:** ⚠️ @deprecated

#### 3. GET /api/overtime/stats
- **Function:** `getOvertimeStats(userId)`
- **Returns:** `{total, currentMonth, lastMonth, trend}`
- **Used by:** Unknown (legacy dashboard?)
- **Status:** ⚠️ @deprecated

#### 4. GET /api/overtime/all
- **Function:** `getAllUsersOvertimeSummary(year, month?)`
- **Returns:** All users' overtime summary
- **Used by:** Admin reports
- **Status:** 🟡 Active but should migrate

#### 5. GET /api/overtime/current
- **Function:** `getCurrentOvertimeStats(userId)`
- **Returns:** `{today, thisWeek, thisMonth, totalYear}`
- **Used by:** 🔴 **DASHBOARD WIDGET** (CalendarPage.tsx)
- **Problem:** Uses `getOvertimeSummary()` which reads from `overtime_balance`
- **Status:** 🚨 **BUG SOURCE** - Shows wrong values!

#### 6. GET /api/overtime/:userId
- **Function:** `getOvertimeSummary(userId, year)`
- **Returns:** Detailed yearly summary with monthly breakdown
- **Used by:** User detail pages?
- **Status:** 🟡 Mixed (recalculates but stores in balance)

---

### Group B: NEW Endpoints (using overtime_transactions)

#### 7. GET /api/overtime/transactions
- **Function:** `getOvertimeHistory(userId, year, limit)` from overtimeTransactionService
- **Returns:** `{transactions: [], currentBalance: number}`
- **Used by:** Reports page "Überstunden-Transaktionen" section
- **Status:** ✅ PRODUCTION - Works correctly

#### 8. GET /api/reports/overtime/user/:userId
- **Function:** `getUserOvertimeReport(userId, year, month?)`
- **Returns:** Complete breakdown `{summary, breakdown: {daily, weekly, monthly}}`
- **Used by:** Detailed user reports
- **Status:** ✅ PRODUCTION

#### 9. GET /api/reports/overtime/history/:userId
- **Function:** `getOvertimeHistory(userId, months)` from reportService
- **Returns:** Monthly history `[{month, earned, compensation, correction, carryover, balance}]`
- **Used by:** 🟢 **REPORTS PAGE** - WorkTimeAccountHistory component
- **Status:** ✅ PRODUCTION - Shows **correct** values (+57:30h)

#### 10. GET /api/reports/overtime/year-breakdown/:userId
- **Function:** `getOvertimeYearBreakdown(userId)`
- **Returns:** `{totalBalance, carryoverFromPreviousYear, earnedThisYear, currentMonth}`
- **Used by:** Reports page summary widgets
- **Status:** ✅ PRODUCTION

---

### Group C: Correction Endpoints

#### 11. POST /api/overtime/corrections
- **Function:** `createOvertimeCorrection({userId, hours, date, reason, correctionType}, createdBy)`
- **Effect:** Creates correction + triggers `updateMonthlyOvertime()`
- **Problem:** ⚠️ Updates overtime_balance but doesn't create transaction!
- **Status:** 🟡 Partial - Works but inconsistent

#### 12. GET /api/overtime/corrections
- **Function:** `getOvertimeCorrectionsForUser(userId)` or `getAllOvertimeCorrections()`
- **Returns:** List of corrections
- **Status:** ✅ Works

#### 13. DELETE /api/overtime/corrections/:id
- **Function:** `deleteOvertimeCorrection(id, deletedBy)`
- **Effect:** Deletes correction + triggers `updateMonthlyOvertime()`
- **Problem:** ⚠️ Same as POST - doesn't sync to transactions
- **Status:** 🟡 Partial

#### 14. GET /api/overtime/corrections/statistics
- **Function:** `getCorrectionStatistics(userId?)`
- **Returns:** Correction stats
- **Status:** ✅ Works

---

### Group D: Auxiliary Endpoints

#### 15. GET /api/overtime/daily/:userId/:date
- **Function:** `getDailyOvertime(userId, date)`
- **Returns:** `{date, targetHours, actualHours, overtime}`
- **Used by:** Day detail views?
- **Status:** 🟡 Uses balance table

#### 16. GET /api/overtime/weekly/:userId/:week
- **Function:** `getWeeklyOvertime(userId, week)`
- **Returns:** `{week, targetHours, actualHours, overtime}`
- **Used by:** Week summary views?
- **Status:** 🟡 Uses balance table

#### 17. GET /api/overtime/summary/:userId/:year
- **Function:** `getOvertimeSummary(userId, year)`
- **Returns:** Complete yearly summary
- **Used by:** Various summary views
- **Status:** 🟡 Uses balance table (via ensureOvertimeBalanceEntries)

#### 18. POST /api/overtime/recalculate-all
- **Function:** `ensureOvertimeBalanceEntries()` for all users
- **Effect:** Recalculates and fills missing months in overtime_balance
- **Used by:** Admin maintenance
- **Status:** ✅ Works (but only updates balance, not transactions!)

---

## 🐛 IDENTIFIED BUGS

### Bug #1: Dashboard Widget Shows Wrong Overtime ⚠️⚠️⚠️

**Location:** Frontend `desktop/src/pages/CalendarPage.tsx` (line ~30-50)

**Current Code:**
```typescript
// Widget in header showing overtime
// Uses: GET /api/overtime/current
// Returns: getCurrentOvertimeStats() from overtimeService.ts
// Problem: Uses overtime_balance table (monthly aggregation)
```

**Evidence:**
- User 155: Widget shows **-7:30h**
- Same user in reports: **+57:30h**
- Difference: **64 hours!**

**Root Cause:**
```
Monthly aggregation:
Dez 2025: 149h actual - 156h target = -7h
Jan 2026: 82h actual - 90h target = -8h
Total: -15h ≈ -7.5h average ❌ WRONG!

Transaction-based:
Dez 2025: +37h earned (including +13h weekend work!)
Jan 2026: +20.5h earned
Total: +57.5h ✅ CORRECT!
```

**Fix:** Change widget to use `GET /api/reports/overtime/year-breakdown`

---

### Bug #2: Weekend Work Lost in Monthly Aggregation ⚠️⚠️

**Example:** User 155 worked on Saturdays in December 2025
- 06.12.2025 (Saturday): 6h worked, 0h target → Should be +6h overtime
- 13.12.2025 (Saturday): 7h worked, 0h target → Should be +7h overtime

**What happens:**

**Transaction Method (CORRECT):**
```
For each day:
  if workSchedule.saturday exists → target = workSchedule.saturday
  else → target = 0h

06.12: earned = 6h - 0h = +6h ✅
13.12: earned = 7h - 0h = +7h ✅
```

**Balance Method (WRONG):**
```
For entire month:
  totalTarget = SUM(all_days with target > 0)
  totalActual = SUM(all_worked_hours)
  overtime = totalActual - totalTarget

Monthly: 149h - 156h = -7h ❌
Weekend hours "disappear" in the aggregation!
```

**Impact:** Weekend/holiday work is underreported by monthly system.

---

### Bug #3: Corrections Don't Create Transactions ⚠️

**Location:** `server/src/services/overtimeCorrectionsService.ts`

**Current Flow:**
```
1. Admin creates correction via POST /api/overtime/corrections
2. createOvertimeCorrection() runs
3. Saves to overtime_corrections table ✅
4. Calls updateMonthlyOvertime() → Updates overtime_balance ✅
5. BUT: Doesn't create transaction in overtime_transactions! ❌
```

**Result:**
- Corrections visible in `overtime_balance`
- Corrections **NOT visible** in transaction history!
- Reports that use transactions don't show corrections properly

**Fix:** Add transaction creation:
```typescript
// After creating correction:
await recordDailyTransaction(userId, correctionDate, 'correction', hours, description);
```

---

### Bug #4: Inconsistent Data Sync ⚠️

**Problem:** Time entries update balance but not transactions

**Current Flow (when user logs time):**
```
1. timeEntryService.ts → createTimeEntry()
2. Saves to time_entries table ✅
3. Calls updateMonthlyOvertime() → Updates overtime_balance ✅
4. BUT: Doesn't create transaction! ❌
```

**Result:**
- New users get overtime_balance entries only
- No transactions created automatically
- Reports fall back to balance (less accurate)

**Current Workaround:**
- Migration script exists: `migrateOvertimeToTransactions.ts`
- But it's one-time, not ongoing sync!

**Fix:** Add transaction creation to timeEntryService

---

## 📊 DATA FLOW ANALYSIS

### Current State (Inconsistent):

```
User logs time entry
    ↓
timeEntryService.createTimeEntry()
    ↓
Saves to time_entries ✅
    ↓
Calls updateMonthlyOvertime()
    ↓
Updates overtime_balance ✅
    ↓
❌ NO transaction created!

Result:
- balance table updated
- transactions table NOT updated
- Reports show different values!
```

### Desired State (Consistent):

```
User logs time entry
    ↓
timeEntryService.createTimeEntry()
    ↓
Saves to time_entries ✅
    ↓
Calls updateMonthlyOvertime() → Updates balance
    ↓
Calls recordDailyTransaction() → Creates transaction ✅
    ↓
Both tables in sync!

Result:
- All endpoints show same values
- Perfect audit trail
```

---

## 🔍 TEST CASE: User 155 "Test Workflow"

### User Profile:
```
Name: Test Workflow
User ID: 155
Hire Date: 2025-12-01
Weekly Hours: 38h
Work Schedule:
  Monday:    10h
  Tuesday:    8h
  Wednesday:  6h
  Thursday:   8h
  Friday:     6h
  Saturday:   0h (NO work day!)
  Sunday:     0h (NO work day!)
```

### December 2025 Breakdown:

**Time Entries:**
```
135h worked total across 16 days
Including:
- 06.12 (Saturday): 6h
- 13.12 (Saturday): 7h
```

**Absences:**
```
- 18-19.12: sick (2 days) → +14h credit
- 20.12: overtime_comp (1 day) → +0h (already counted)
- 27.12: overtime_comp (1 day) → +0h (already counted)
```

**Calculation (Transaction Method - CORRECT):**
```
Daily breakdown:
02.12 (Tu): 10h - 8h = +2h
03.12 (We): 8h - 6h = +2h
04.12 (Th): 6h - 8h = -2h
05.12 (Fr): 8h - 6h = +2h
06.12 (Sa): 6h - 0h = +6h ← WEEKEND!
...
13.12 (Sa): 7h - 0h = +7h ← WEEKEND!
...
Total: +37h ✅
```

**Calculation (Balance Method - WRONG):**
```
Monthly aggregation:
Target: 156h (all Mo-Fr workdays)
Actual: 149h (135h worked + 14h sick credit)
Overtime: 149h - 156h = -7h ❌

Missing: Weekend hours not properly counted!
```

**Stored Values:**

`overtime_balance` table:
```sql
month='2025-12', targetHours=156, actualHours=149, overtime=-7
```

`overtime_transactions` table:
```sql
SUM(hours WHERE month='2025-12') = +37h
```

**Result:** 44-hour discrepancy! (-7h vs +37h)

---

## 🎯 RECOMMENDATIONS

### Immediate (High Priority):

1. **Fix Dashboard Widget** ⚠️⚠️⚠️
   ```typescript
   // Change from:
   GET /api/overtime/current

   // To:
   GET /api/reports/overtime/year-breakdown
   ```
   **Files to modify:**
   - `desktop/src/pages/CalendarPage.tsx` (or wherever widget is)
   - Create new hook: `useOvertimeYearBreakdown(userId)`

2. **Add Transaction Creation to timeEntryService** ⚠️⚠️
   ```typescript
   // In createTimeEntry():
   await recordDailyTransaction(userId, date, 'earned', earnedHours, description);
   ```

3. **Add Transaction Creation to overtimeCorrectionsService** ⚠️
   ```typescript
   // In createOvertimeCorrection():
   await recordDailyTransaction(userId, date, 'correction', hours, description);
   ```

---

### Medium Priority:

4. **Deprecate Legacy Endpoints**
   - Add @deprecated warnings to all Group A endpoints
   - Update documentation to recommend Group B endpoints
   - Monitor usage and plan removal timeline

5. **Update All Frontend Components**
   - Audit all components using overtime data
   - Migrate to reports endpoints
   - Test thoroughly

6. **Add Migration Script to CI/CD**
   - Run `migrateOvertimeToTransactions` for any users without transactions
   - Automate sync on each deployment

---

### Long-term:

7. **Remove overtime_balance Table**
   - Archive historical data
   - Drop table from schema
   - Remove all references from code

8. **Simplify Architecture**
   - Single source of truth: `overtime_transactions`
   - All calculations from transactions
   - Clean, maintainable codebase

---

## 📁 FILES TO MODIFY

### High Priority:

1. **desktop/src/pages/CalendarPage.tsx** (or widget location)
   - Change endpoint from `/overtime/current` to `/reports/overtime/year-breakdown`

2. **server/src/services/timeEntryService.ts**
   - Add `recordDailyTransaction()` call after creating entry

3. **server/src/services/overtimeCorrectionsService.ts**
   - Add `recordDailyTransaction()` call after creating correction

4. **server/src/services/absenceService.ts**
   - Add `recordDailyTransaction()` call for compensation type

### Medium Priority:

5. **server/src/routes/overtime.ts**
   - Add deprecation warnings
   - Update documentation

6. **All frontend components using overtime data**
   - Audit and migrate to new endpoints

---

## ✅ VALIDATION

To verify the fix works, check User 155:

**Before Fix:**
- Widget: -7:30h ❌
- Reports: +57:30h ✅
- Discrepancy: 64h

**After Fix:**
- Widget: +57:30h ✅
- Reports: +57:30h ✅
- Discrepancy: 0h ✅

---

## 📚 RELATED DOCUMENTATION

- **ARCHITECTURE.md** - Overall system architecture
- **PROJECT_SPEC.md** - Section 6.2 "Overtime Calculation"
- **CHANGELOG.md** - Version history
- **Migration Script:** `server/src/scripts/migrateOvertimeToTransactions.ts`

---

**END OF DOCUMENT**
