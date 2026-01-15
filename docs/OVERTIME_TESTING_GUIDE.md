# Überstunden-Berechnung - Comprehensive Testing Guide

**Purpose:** Quick Reference für AI - Wie teste und validiere ich Überstunden zuverlässig?
**Version:** 1.0
**Last Updated:** 2026-01-15

---

## 📋 Table of Contents

1. [Quick Check Procedure](#quick-check-procedure)
2. [Calculation Formula](#calculation-formula)
3. [Two Modes Explained](#two-modes-explained)
4. [Test Scenarios Checklist](#test-scenarios-checklist)
5. [Common Edge Cases](#common-edge-cases)
6. [SQL Validation Queries](#sql-validation-queries)
7. [Expected Results Tables](#expected-results-tables)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Check Procedure

**Use this 4-step process to validate any user's overtime:**

### Step 1: Get User Data

```sql
SELECT
  id,
  firstName,
  lastName,
  weeklyHours,
  workSchedule,
  hireDate
FROM users
WHERE id = ? AND deletedAt IS NULL;
```

**Check:**
- ✅ `weeklyHours` present
- ✅ `workSchedule` NULL or valid JSON
- ✅ `hireDate` in the past

### Step 2: Calculate Target Hours (Soll-Stunden)

**Formula:**
```
Target = Working Days × Target Hours per Day
```

**Working Days:** From `hireDate` to **TODAY** (beide inklusiv)
- Exclude weekends (Sa/So) if no workSchedule
- Exclude public holidays (ALWAYS!)
- If workSchedule: Only days with hours > 0

**Target Hours per Day:**
- Standard: `weeklyHours / 5`
- workSchedule: `workSchedule[dayName]`
- Holiday: `0h` (overrides everything!)

### Step 3: Calculate Actual Hours (Ist-Stunden)

```
Actual = Worked Hours + Absence Credits
```

**Worked Hours:**
```sql
SELECT SUM(hours) as workedHours
FROM time_entries
WHERE userId = ? AND deletedAt IS NULL;
```

**Absence Credits:**
```sql
SELECT type, startDate, endDate, daysRequired
FROM absence_requests
WHERE userId = ?
  AND status = 'approved'
  AND type IN ('vacation', 'sick', 'overtime_comp');
```

**Credit Calculation:**
- `vacation`: `daysRequired × targetHoursPerDay`
- `sick`: `daysRequired × targetHoursPerDay`
- `overtime_comp`: `daysRequired × targetHoursPerDay`
- `unpaid`: NO CREDIT, reduces target instead!

### Step 4: Calculate Overtime

```
Overtime = Actual Hours - Target Hours
```

**Interpretation:**
- `+10:00h` → Positive overtime (10h over target)
- `-05:30h` → Negative overtime (5.5h below target)
- `+00:00h` → Exactly on target

---

## 📐 Calculation Formula

### The Fundamental Formula (NEVER CHANGE!)

```
Überstunden = Ist-Stunden - Soll-Stunden
```

### Detailed Breakdown

#### Soll-Stunden (Target Hours)

```
Soll = (Working Days × Target/Day) - Unpaid Leave Hours
```

**Where:**
- **Working Days:** From hireDate to today, excluding weekends & holidays
- **Target/Day:** Based on weeklyHours or workSchedule
- **Unpaid Leave:** Reduces target (e.g., 3 days unpaid = -24h for 40h/week)

#### Ist-Stunden (Actual Hours)

```
Ist = Worked Hours + Vacation + Sick Leave + Overtime Comp
```

**Where:**
- **Worked Hours:** Sum of all time_entries
- **Vacation/Sick/Overtime Comp:** Absence credits (as if worked)
- **Unpaid:** NOT included (not credited!)

---

## 🔄 Two Modes Explained

### Mode 1: Standard Weekly Hours (weeklyHours only)

**User Configuration:**
```json
{
  "weeklyHours": 40,
  "workSchedule": null
}
```

**Calculation:**
- Target per day: `40h / 5 = 8h`
- Working days: Monday-Friday
- Weekends: Saturday-Sunday = 0h
- Holidays: Always 0h

**Example:**
```
User: 40h/week, hired Monday Nov 3, 2025
Today: Tuesday Nov 11, 2025

Working days: Mo-Fr (5) + Mo-Tu (2) = 7 days
Target: 7 × 8h = 56h
```

---

### Mode 2: Individual Work Schedule (workSchedule)

**User Configuration:**
```json
{
  "weeklyHours": 30,
  "workSchedule": {
    "monday": 8,
    "tuesday": 0,      // ← NOT a working day!
    "wednesday": 6,
    "thursday": 8,
    "friday": 8,
    "saturday": 0,
    "sunday": 0
  }
}
```

**Calculation:**
- Target per day: **From workSchedule**
- Working days: **Only days with hours > 0**
- Tuesday: 0h = NOT a working day
- Holidays: Always 0h (overrides workSchedule!)

**Example:**
```
User: Hans, Mo=8h, Tu=0h, We=6h, Th=8h, Fr=8h
Week: Monday Feb 3 - Friday Feb 7, 2025

Working days: Mo, We, Th, Fr (4 days, Tuesday excluded!)
Target: 8 + 6 + 8 + 8 = 30h
```

**CRITICAL:** Days with 0h do NOT count as working days!

---

## ✅ Test Scenarios Checklist

Use this checklist to validate all scenarios:

### Basic Scenarios

- [ ] **Standard 40h/week** (Mo-Fr, no workSchedule)
- [ ] **Part-time 30h/week** (Mo-Fr, no workSchedule)
- [ ] **Part-time 20h/week** (Mo-Fr, no workSchedule)
- [ ] **Aushilfe** (weeklyHours=0, no workSchedule)

### Individual Work Schedule

- [ ] **Full work week** (Mo-Fr all > 0h)
- [ ] **With 0h days** (e.g., Mo=8h, Tu=0h, We=6h)
- [ ] **Weekend work** (Saturday or Sunday with hours)
- [ ] **Mixed schedule** (different hours per day)

### Holidays

- [ ] **Holiday in period** (e.g., Jan 1, May 1)
- [ ] **Holiday on workSchedule day** (should override to 0h)
- [ ] **Multiple holidays** (e.g., Christmas week)
- [ ] **Holiday + weekend** (should not double-count)

### Absences

- [ ] **Vacation** (1 day, 1 week, multiple weeks)
- [ ] **Sick leave** (short-term, long-term)
- [ ] **Overtime compensation** (Überstundenausgleich)
- [ ] **Unpaid leave** (reduces target!)
- [ ] **Mixed absences** (vacation + sick in same month)

### Absence + workSchedule Edge Cases

- [ ] **Vacation on 0h day** (should give 0 credit)
- [ ] **Sick leave on weekend** (no credit if not working day)
- [ ] **Vacation during holiday** (already 0h target)
- [ ] **Unpaid on workSchedule day** (reduces target by actual hours)

### Time Ranges

- [ ] **Hire date = today** (1 working day)
- [ ] **Hire date on weekend** (weekend doesn't count)
- [ ] **Full month** (all working days)
- [ ] **Year boundary** (Dec-Jan)
- [ ] **DST change** (March/October in Germany)

### Integration

- [ ] **Multiple time entries** (sum correctly)
- [ ] **Multiple absences** (credit all approved ones)
- [ ] **Work time account** (balance updates)
- [ ] **Overtime transactions** (recorded correctly)

---

## 🚨 Common Edge Cases

### Edge Case 1: Holiday overrides workSchedule

**Scenario:**
- User: Hans, Mo=8h, Tu=8h, We=6h, Th=8h, Fr=8h
- Date: Thursday, May 1, 2025 (Tag der Arbeit = Holiday)

**Expected:**
- Thursday target: `0h` (holiday overrides workSchedule!)
- NOT 8h from workSchedule

**Why:**
- Holidays are ALWAYS 0h target
- Database holidays table takes precedence

**SQL Check:**
```sql
SELECT date FROM holidays WHERE date = '2025-05-01';
-- Should return row → Target = 0h
```

---

### Edge Case 2: Vacation on 0h day

**Scenario:**
- User: Hans, Mo=8h, Tu=0h, We=6h, Th=8h, Fr=8h
- Vacation: Tuesday, Feb 4, 2025 (0h day)

**Expected:**
- Vacation credit: `0h` (not a working day!)
- NOT 8h or weeklyHours/5

**Why:**
- Tuesday = 0h in workSchedule
- Absence credit = targetHours for that day = 0h

**Calculation:**
```typescript
const targetForTuesday = workSchedule['tuesday']; // 0h
const vacationCredit = 0h;
```

---

### Edge Case 3: Unpaid leave reduces target

**Scenario:**
- User: 40h/week = 8h/day
- Unpaid leave: Monday-Wednesday (3 days)
- Worked: Thursday-Friday (16h)

**Expected:**
- Target: `(5 - 3) × 8h = 16h` (unpaid reduces!)
- Actual: `16h` (no credit for unpaid)
- Overtime: `16h - 16h = 0h`

**Why:**
- Unpaid leave does NOT give credit
- Reduces target instead

**Calculation:**
```typescript
const baseTar

get = 5 × 8h = 40h;
const unpaidHours = 3 × 8h = 24h;
const adjustedTarget = 40h - 24h = 16h;
```

---

### Edge Case 4: Hire date on weekend

**Scenario:**
- User: 40h/week
- Hire date: Saturday, Nov 8, 2025
- Today: Tuesday, Nov 11, 2025

**Expected:**
- Working days: Monday (10), Tuesday (11) = 2 days
- Target: `2 × 8h = 16h`

**Why:**
- Hire date weekend (Sat, Sun) doesn't count
- First working day: Monday Nov 10

**SQL:**
```sql
-- Working days from '2025-11-08' to '2025-11-11'
-- Sat 8, Sun 9 = weekend (excluded)
-- Mon 10, Tue 11 = 2 working days
```

---

### Edge Case 5: Sick leave during holiday

**Scenario:**
- User: 40h/week
- Holiday: Thursday, May 1, 2025 (Tag der Arbeit)
- Sick leave: Mon-Fri (including Thursday)

**Expected:**
- Thursday: Already 0h target (holiday)
- Sick credit for Thursday: `0h` (no credit for holidays!)
- Sick credit for Mon, Tue, Wed, Fri: `4 × 8h = 32h`

**Why:**
- Holiday already reduces target to 0h
- Absence on holiday gives no additional credit

**Calculation:**
```typescript
// Monday-Friday, but Thursday is holiday
const sickDays = 5; // calendar days
const holidaysInPeriod = 1; // Thursday
const workingDaysSick = sickDays - 1 - 0 = 4; // -1 holiday, -0 weekends
const sickCredit = 4 × 8h = 32h;
```

---

### Edge Case 6: Overtime compensation validation

**Scenario:**
- User: 40h/week, current overtime: `+20h`
- Requests overtime_comp: Friday (1 day)

**Expected:**
- Must have at least 8h overtime (1 day = 8h)
- After approval: overtime reduced by 8h
- Friday credited as if worked (8h)

**Validation:**
```typescript
const currentOvertime = 20h;
const requestedDays = 1;
const requiredOvertime = 1 × 8h = 8h;

if (currentOvertime >= requiredOvertime) {
  // Approve and deduct
  newOvertime = 20h - 8h = 12h;
} else {
  // Reject - not enough overtime
}
```

---

### Edge Case 7: Month with many holidays

**Scenario:**
- User: 40h/week
- Month: December 2025
- Holidays: Dec 24, 25, 26 (Weihnachten)
- Working days in Dec: 23 - 3 holidays = 20 days

**Expected:**
- Target: `20 × 8h = 160h` (not 23 × 8h = 184h)

**Why:**
- Holidays reduce working days
- Each holiday = 0h target

---

### Edge Case 8: Weekend work with workSchedule

**Scenario:**
- User: workSchedule = { ..., saturday: 4, sunday: 0 }
- Period: Sat-Sun, Nov 8-9, 2025

**Expected:**
- Saturday: 4h target (working day with hours!)
- Sunday: 0h target (0h in workSchedule)
- Working days: 1 (only Saturday)

**Why:**
- workSchedule allows weekend work
- Days with hours > 0 count as working days

---

### Edge Case 9: DST change (Daylight Saving Time)

**Scenario:**
- Date: March 30, 2025 (DST change in Germany)
- User: 40h/week
- Working days calculation crosses DST boundary

**Expected:**
- Count days correctly (UTC-based calculation)
- No off-by-one errors due to timezone shifts

**Implementation:**
```typescript
// Use UTC dates to avoid DST issues
const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
```

**See:** `workingDays.ts:271-287` for correct implementation

---

### Edge Case 10: User with weeklyHours=0 (Aushilfe)

**Scenario:**
- User: weeklyHours=0, no workSchedule
- Worked: 20h this month

**Expected:**
- Target: `0h` (no contracted hours)
- Actual: `20h`
- Overtime: `20h - 0h = +20h` (all hours are overtime!)

**Why:**
- Aushilfen (helpers) have no target hours
- Everything they work counts as extra

---

## 🔍 SQL Validation Queries

### Query 1: Get User Overtime Breakdown

```sql
SELECT
  u.id,
  u.firstName,
  u.lastName,
  u.weeklyHours,
  u.workSchedule,
  u.hireDate,

  -- Worked hours
  COALESCE(SUM(te.hours), 0) as workedHours,

  -- Count time entries
  COUNT(te.id) as entryCount

FROM users u
LEFT JOIN time_entries te ON te.userId = u.id AND te.deletedAt IS NULL
WHERE u.id = ? AND u.deletedAt IS NULL
GROUP BY u.id;
```

---

### Query 2: Get All Approved Absences

```sql
SELECT
  ar.id,
  ar.type,
  ar.startDate,
  ar.endDate,
  ar.daysRequired,
  ar.status,
  ar.createdAt
FROM absence_requests ar
WHERE ar.userId = ?
  AND ar.status = 'approved'
ORDER BY ar.startDate ASC;
```

**Credit Calculation:**
```typescript
const absences = /* query result */;
let totalCredit = 0;

for (const absence of absences) {
  if (['vacation', 'sick', 'overtime_comp'].includes(absence.type)) {
    // Calculate hours for this absence period
    const hours = calculateAbsenceHours(
      user,
      absence.startDate,
      absence.endDate
    );
    totalCredit += hours;
  }
  // 'unpaid' type: No credit, reduces target instead
}
```

---

### Query 3: Get Holidays in Period

```sql
SELECT date, name
FROM holidays
WHERE date BETWEEN ? AND ?
ORDER BY date ASC;
```

**Usage:**
```typescript
const holidays = db.prepare(`
  SELECT date FROM holidays WHERE date BETWEEN ? AND ?
`).all(hireDate, today);

const holidayDates = holidays.map(h => h.date);
// Use to exclude from working days count
```

---

### Query 4: Complete Overtime Calculation (SQL)

**Complex query that calculates everything:**

```sql
WITH user_data AS (
  SELECT
    u.id,
    u.firstName,
    u.lastName,
    u.weeklyHours,
    u.workSchedule,
    u.hireDate
  FROM users u
  WHERE u.id = ? AND u.deletedAt IS NULL
),
worked_hours AS (
  SELECT
    COALESCE(SUM(te.hours), 0) as hours
  FROM time_entries te
  WHERE te.userId = ? AND te.deletedAt IS NULL
),
absence_credits AS (
  SELECT
    ar.type,
    ar.startDate,
    ar.endDate,
    ar.daysRequired
  FROM absence_requests ar
  WHERE ar.userId = ?
    AND ar.status = 'approved'
    AND ar.type IN ('vacation', 'sick', 'overtime_comp')
)
SELECT
  ud.*,
  wh.hours as workedHours
FROM user_data ud
CROSS JOIN worked_hours wh;

-- Note: Absence credits and target calculation
-- need TypeScript logic (workSchedule, holidays)
```

---

### Query 5: Validate Work Time Account Balance

```sql
SELECT
  wta.id,
  wta.userId,
  wta.currentBalance,
  wta.maxPlusHours,
  wta.maxMinusHours,
  wta.lastUpdated,
  u.firstName,
  u.lastName
FROM work_time_accounts wta
JOIN users u ON wta.userId = u.id
WHERE wta.userId = ? AND u.deletedAt IS NULL;
```

**Expected:**
- `currentBalance` should match calculated overtime
- Updated recently (`lastUpdated`)

---

## 📊 Expected Results Tables

### Scenario 1: Standard 40h Worker

| Metric | Value | Notes |
|--------|-------|-------|
| weeklyHours | 40 | Standard full-time |
| workSchedule | null | Mo-Fr, 8h/day |
| Hire Date | 2025-11-03 (Mon) | Start of week |
| Today | 2025-11-11 (Tue) | 7 working days later |
| Working Days | 7 | Mon-Fri (5) + Mon-Tue (2) |
| Target | 56h | 7 × 8h |
| Worked | 48h | Example: 6h/day average |
| Absences | 0h | No absences |
| **Overtime** | **-8h** | 48h - 56h |

---

### Scenario 2: Hans (Individual Schedule)

| Metric | Value | Notes |
|--------|-------|-------|
| weeklyHours | 30 | Part-time |
| workSchedule | Mo=8h, Tu=0h, We=6h, Th=8h, Fr=8h | 4 working days |
| Hire Date | 2025-02-03 (Mon) | |
| Period | 2025-02-03 to 2025-02-07 (Fri) | 5 calendar days |
| Working Days | 4 | Mo, We, Th, Fr (Tu excluded!) |
| Target | 30h | 8 + 6 + 8 + 8 |
| Worked | 28h | Example |
| Absences | 0h | |
| **Overtime** | **-2h** | 28h - 30h |

---

### Scenario 3: Vacation Week

| Metric | Value | Notes |
|--------|-------|-------|
| weeklyHours | 40 | |
| Hire Date | 2025-01-01 | Long-term employee |
| Period | Full January 2025 | 23 working days |
| Vacation | Mon-Fri, Jan 6-10 | 5 days |
| Working Days | 23 | All of January |
| Target | 184h | 23 × 8h |
| Worked | 144h | 18 days × 8h |
| Absence Credit | 40h | 5 vacation days × 8h |
| **Overtime** | **0h** | 144h + 40h - 184h = 0h |

---

### Scenario 4: Sick Leave on 0h Day

| Metric | Value | Notes |
|--------|-------|-------|
| workSchedule | Mo=8h, Tu=0h, We=6h | |
| Sick Leave | Tuesday Feb 4 | 0h day! |
| Target for Tue | 0h | Tu = 0h in schedule |
| Sick Credit | 0h | No credit for 0h days |
| **Impact** | **None** | Already 0h target |

---

### Scenario 5: Unpaid Leave

| Metric | Value | Notes |
|--------|-------|-------|
| weeklyHours | 40 | |
| Period | Week Mo-Fr | 5 working days |
| Unpaid Leave | Mon-Wed | 3 days |
| Base Target | 40h | 5 × 8h |
| Unpaid Adjustment | -24h | -3 × 8h |
| Adjusted Target | 16h | 40h - 24h |
| Worked | 16h | Thu-Fri only |
| Absences | 0h | Unpaid = no credit |
| **Overtime** | **0h** | 16h - 16h |

---

## 🔧 Troubleshooting

### Problem: Overtime doesn't match expected

**Steps:**

1. **Check hire date**
   ```sql
   SELECT hireDate FROM users WHERE id = ?;
   ```
   - Should be in the past
   - Not in the future!

2. **Verify working days count**
   ```typescript
   const workingDays = countWorkingDaysBetween(hireDate, today);
   console.log('Working days:', workingDays);
   ```
   - Use validation script (see below)

3. **Check holidays in period**
   ```sql
   SELECT date, name FROM holidays
   WHERE date BETWEEN ? AND ?;
   ```
   - Each holiday = -1 working day

4. **Verify workSchedule**
   ```sql
   SELECT workSchedule FROM users WHERE id = ?;
   ```
   - Parse JSON
   - Check for 0h days (don't count as working days!)

5. **Check all absences**
   ```sql
   SELECT * FROM absence_requests
   WHERE userId = ? AND status = 'approved';
   ```
   - Calculate credit for each
   - `unpaid` type should reduce target, not give credit

6. **Sum time entries**
   ```sql
   SELECT SUM(hours) FROM time_entries
   WHERE userId = ? AND deletedAt IS NULL;
   ```

---

### Problem: Absence credit incorrect

**Checklist:**

- [ ] Absence status = 'approved'?
- [ ] Absence type in ['vacation', 'sick', 'overtime_comp']?
- [ ] Absence period doesn't overlap holidays?
- [ ] If workSchedule: Period doesn't include 0h days?
- [ ] Credit calculation uses correct targetHours/day?

**Debug:**
```typescript
const absence = /* ... */;
const creditHours = calculateAbsenceHoursWithWorkSchedule(
  absence.startDate,
  absence.endDate,
  user.workSchedule,
  user.weeklyHours
);
console.log('Absence credit:', creditHours);
```

---

### Problem: Holiday not excluded

**Check:**

1. Holiday exists in database?
   ```sql
   SELECT * FROM holidays WHERE date = '2025-05-01';
   ```

2. `getDailyTargetHours()` checks holidays first?
   ```typescript
   // Line 54-60 in workingDays.ts
   const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
   if (holiday) return 0;
   ```

3. Date format correct? (YYYY-MM-DD)

---

### Problem: workSchedule not respected

**Check:**

1. workSchedule is valid JSON?
   ```sql
   SELECT workSchedule FROM users WHERE id = ?;
   ```

2. Days with 0h counted as working days? (WRONG!)
   ```typescript
   // Should NOT count tuesday
   workSchedule = { monday: 8, tuesday: 0, wednesday: 6 }
   // Working days per week = 2 (not 3!)
   ```

3. `getDailyTargetHours()` uses workSchedule?
   ```typescript
   // Line 63-66 in workingDays.ts
   if (user.workSchedule) {
     const dayName = getDayName(date);
     return user.workSchedule[dayName] || 0;
   }
   ```

---

## 🎯 Validation Commands

### Run Validation Script

```bash
# Validate specific user
cd server
npm run validate:overtime -- --userId=5

# Validate all users
npm run validate:overtime -- --all

# Compare with expected value
npm run validate:overtime -- --userId=5 --expected="+37:30"
```

### Run Tests

```bash
# All overtime tests
npm test workingDays

# Specific test suite
npm test -- --grep "Individual Work Schedule"

# Watch mode
npm test -- --watch workingDays.test.ts
```

### Quick SQL Checks

```bash
# Connect to database
sqlite3 server/database.db

# Check user data
.mode column
.headers on
SELECT id, firstName, lastName, weeklyHours, hireDate FROM users WHERE id = 5;

# Check holidays
SELECT date, name FROM holidays WHERE date LIKE '2025%';

# Check absences
SELECT type, startDate, endDate, status FROM absence_requests WHERE userId = 5;
```

---

## 📖 Related Documentation

- **Core Implementation:** `server/src/utils/workingDays.ts`
- **Test Suite:** `server/src/utils/workingDays.test.ts`
- **Validation Script:** `server/src/scripts/validateOvertimeCalculation.ts` (to be created)
- **Test Data Generator:** `server/src/test/generateTestData.ts` (to be created)
- **Architecture:** `ARCHITECTURE.md` → Section 6.3 "Overtime Calculation"
- **Specification:** `PROJECT_SPEC.md` → Section 6.2 "Overtime Calculation"

---

## 🤖 AI Quick Reference

**When user asks "check overtime for user X":**

1. Read this guide (Quick Check Procedure section)
2. Run SQL queries to get user data
3. Calculate target hours (consider workSchedule + holidays)
4. Calculate actual hours (worked + absence credits)
5. Compute overtime = actual - target
6. Check for edge cases (see Common Edge Cases section)
7. Report result with breakdown

**When implementing new overtime logic:**

1. Check if edge case already documented here
2. Add test to `workingDays.test.ts`
3. Implement logic in `workingDays.ts`
4. Run validation script to verify
5. Update this guide if new edge case discovered

---

**Last Updated:** 2026-01-15
**Version:** 1.0
**Maintainer:** AI Development Team
