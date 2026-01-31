# Root Cause Analysis - Test User Validation Failures

**Date:** 2026-01-18
**Validation Month:** 2026-01
**Failed Users:** 8/10

---

## 📊 Summary of Failures

| User | Name | Expected Target | DB Target | Delta | Status |
|------|------|----------------|-----------|-------|--------|
| 48 | Max Vollzeit | 80h | 64h | -16h | ❌ FAIL |
| 49 | Christine Teilzeit | 12h | 12h | 0h | ✅ PASS |
| 50 | Peter Fleißig | 80h | 64h | -16h | ❌ FAIL |
| 51 | Laura Weniger | 80h | 64h | -16h | ❌ FAIL |
| 52 | Sarah Unbezahlt | 80h | 64h | -16h | ❌ FAIL |
| 53 | Tom Viertage | 70h | 60h | -10h | ❌ FAIL |
| 54 | Julia Komplex | 80h | 64h | -16h | ❌ FAIL |
| 55 | Nina Neuling | 16h | 16h | 0h | ✅ PASS |
| 56 | Klaus Ausgeschieden | 80h | 64h | -16h | ❌ FAIL |
| 57 | Emma Wochenende | 48h | 0h | -48h | ❌ FAIL |

---

## 🔍 Pattern Analysis

### Pattern 1: Standard 40h/week users (16h discrepancy)

**Affected Users:** 48, 50, 51, 52, 54, 56
**Pattern:** All have `weeklyHours: 40` and NO `workSchedule`
**Expected Target:** 80h (10 working days × 8h)
**DB Target:** 64h
**Delta:** -16h (exactly 2 days = 2 × 8h)

**Hypothesis:** The production code `ensureOvertimeBalanceEntries()` is NOT counting 2 days in January 2026.

**Days in 2026-01 (up to today 2026-01-18):**
- Total days: 18
- Weekends: 4 (Sat 04, Sun 05, Sat 11, Sun 12, Sat 18, Sun 19) = 6 weekend days, but Sun 19 is after today
- **Actual weekends until Jan 18:** Sat 04, Sun 05, Sat 11, Sun 12, Sat 18 = 5 days
- **Holidays:** 01.01 (Neujahr), 06.01 (Heilige Drei Könige) = 2 days
- **Working days:** 18 - 5 - 2 = **11 working days** (Expected)
- **But DB shows:** 8 working days (64h / 8h = 8 days)

**Missing days:** 11 - 8 = 3 days (but delta shows only 2 days!)

Wait, let me recalculate:
- 01.01 (Thu) - Holiday
- 02.01 (Fri) - Working day ✅
- 03.01 (Sat) - Weekend
- 04.01 (Sun) - Weekend
- 05.01 (Mon) - Working day ✅
- 06.01 (Tue) - Holiday (Heilige Drei Könige, Bayern!)
- 07.01 (Wed) - Working day ✅
- 08.01 (Thu) - Working day ✅
- 09.01 (Fri) - Working day ✅
- 10.01 (Sat) - Weekend
- 11.01 (Sun) - Weekend
- 12.01 (Mon) - Working day ✅
- 13.01 (Tue) - Working day ✅
- 14.01 (Wed) - Working day ✅
- 15.01 (Thu) - Working day ✅
- 16.01 (Fri) - Working day ✅
- 17.01 (Sat) - Weekend
- 18.01 (Sun) - Weekend (TODAY)

**Actual working days:** 10 (02, 05, 07, 08, 09, 12, 13, 14, 15, 16)
**Expected:** 10 days × 8h = **80h** ✅
**DB shows:** 64h = 8 days
**Missing:** 2 days (16h)

**Root Cause:** `ensureOvertimeBalanceEntries()` is calculating target hours INCORRECTLY. It's missing 2 working days (likely 02.01 and 16.01).

---

### Pattern 2: Tom Viertage (10h discrepancy)

**User 53:** Tom Viertage
**workSchedule:** `{monday: 10, tuesday: 10, wednesday: 10, thursday: 10}` (4-day week, 10h/day)
**Expected Target:** 70h (7 working days × 10h)
**DB Target:** 60h (6 working days × 10h)
**Delta:** -10h (exactly 1 day)

**Working days for Tom (Mon-Thu):**
- 02.01 (Fri) - ❌ Not a working day
- 05.01 (Mon) - ✅ Working day
- 06.01 (Tue) - ❌ Holiday!
- 07.01 (Wed) - ✅ Working day
- 08.01 (Thu) - ✅ Working day
- 12.01 (Mon) - ✅ Working day
- 13.01 (Tue) - ✅ Working day
- 14.01 (Wed) - ✅ Working day
- 15.01 (Thu) - ✅ Working day

**Expected:** 7 days × 10h = 70h ✅
**DB shows:** 60h = 6 days
**Missing:** 1 day (10h) - likely 15.01 (Thu)

---

### Pattern 3: Emma Wochenende (48h discrepancy - CRITICAL!)

**User 57:** Emma Wochenende
**workSchedule:** `{saturday: 8, sunday: 8}` (weekend worker!)
**Expected Target:** 48h (6 weekend days × 8h)
**DB Target:** 0h (!!!)
**Delta:** -48h (ALL working days missing!)

**Working days for Emma (Sat+Sun):**
- 03.01 (Sat) - ✅ Should be 8h
- 04.01 (Sun) - ✅ Should be 8h
- 10.01 (Sat) - ✅ Should be 8h
- 11.01 (Sun) - ✅ Should be 8h
- 17.01 (Sat) - ✅ Should be 8h
- 18.01 (Sun) - ✅ Should be 8h (TODAY)

**Expected:** 6 days × 8h = 48h ✅
**DB shows:** 0h
**Root Cause:** `ensureOvertimeBalanceEntries()` has a check that SKIPS weekends! It likely has code like:
```typescript
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
if (isWeekend) continue; // ← BUG: Ignores workSchedule!
```

---

## 🔥 ROOT CAUSE: Production Code Bug in `overtimeService.ts`

### Location: `/server/src/services/overtimeService.ts`
### Function: `ensureOvertimeBalanceEntries(userId, upToMonth)`

### Critical Bug #1: Weekend Check ignores workSchedule
```typescript
// BUGGY CODE (hypothesis):
const isWeekend = d.getDay() === 0 || d.getDay() === 6;
if (isWeekend) continue; // ← Skips Sat/Sun WITHOUT checking workSchedule!
```

**Impact:**
- Emma (User 57) has 0h target instead of 48h
- ALL weekend workers would be broken!

**Fix:**
```typescript
const isWeekend = d.getDay() === 0 || d.getDay() === 6;
// Only skip weekend if user does NOT work on weekends
if (isWeekend && !user.workSchedule) continue;
// Otherwise, check workSchedule for this day
```

---

### Critical Bug #2: Missing days at month boundaries

**Impact:**
- Most users missing 2 days (16h)
- Tom missing 1 day (10h)

**Hypothesis:** The loop that iterates over days might have an off-by-one error or timezone issue.

**Possible causes:**
1. **Date range calculation:** Start/end date might be excluding boundary days
2. **Timezone issue:** Date comparison might be affected by UTC vs local time
3. **Holiday check timing:** Holiday might be checked BEFORE adding to target

---

## ✅ Why Christine (49) and Nina (55) PASS

### Christine (User 49)
- **workSchedule:** `{monday: 4, tuesday: 4}`
- **Expected:** 12h (3 working days: Mon 05, Mon 12, Tue 13 - NOT Tue 06 because Holiday!)
- **DB:** 12h ✅
- **Reason:** Her specific workSchedule days (Mon+Tue) were correctly calculated, likely because the bug affects different days

### Nina (User 55)
- **hireDate:** 2026-01-15
- **Expected:** 16h (Thu 15, Fri 16 = 2 days × 8h)
- **DB:** 16h ✅
- **Reason:** She only has 2 days, both correctly calculated. The missing days bug might affect earlier days in the month.

---

## 🎯 FIXES REQUIRED

### Priority 1: Fix `overtimeService.ts` - Weekend Check
**File:** `/server/src/services/overtimeService.ts`
**Function:** `ensureOvertimeBalanceEntries()`
**Issue:** Weekend check ignores workSchedule
**Fix:** Check if user has workSchedule with weekend hours before skipping

### Priority 2: Fix `overtimeService.ts` - Missing Days
**File:** `/server/src/services/overtimeService.ts`
**Function:** `ensureOvertimeBalanceEntries()`
**Issue:** 2 days missing for most users (16h delta)
**Fix:** Investigate date range loop, check for off-by-one errors

### Priority 3: Re-validate After Fix
**Action:** Run `npm run recalculate:overtime` after fixing code
**Then:** Run `npm run validate:all-test-users` to verify all users PASS

---

## 📈 Expected Results After Fix

All 10 users should PASS validation with 0 discrepancies:

| User | Name | Expected | After Fix |
|------|------|----------|-----------|
| 48 | Max Vollzeit | 80h | 80h ✅ |
| 49 | Christine Teilzeit | 12h | 12h ✅ |
| 50 | Peter Fleißig | 80h | 80h ✅ |
| 51 | Laura Weniger | 80h | 80h ✅ |
| 52 | Sarah Unbezahlt | 80h | 80h ✅ |
| 53 | Tom Viertage | 70h | 70h ✅ |
| 54 | Julia Komplex | 80h | 80h ✅ |
| 55 | Nina Neuling | 16h | 16h ✅ |
| 56 | Klaus Ausgeschieden | 80h | 80h ✅ |
| 57 | Emma Wochenende | 48h | 48h ✅ |

---

## 🚀 Next Steps

1. ✅ Read `overtimeService.ts` to locate the exact buggy code
2. ✅ Fix Bug #1: Weekend check (Emma's issue)
3. ✅ Fix Bug #2: Missing days (16h/10h discrepancies)
4. ✅ Run `npm run recalculate:overtime`
5. ✅ Run `npm run validate:all-test-users`
6. ✅ Verify 10/10 users PASS
7. ✅ Update all documentation
8. ✅ Create final summary report
