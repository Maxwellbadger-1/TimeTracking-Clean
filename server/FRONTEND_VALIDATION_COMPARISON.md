# Frontend Overtime Values - Validation Report
**Date:** 2026-01-18
**Screenshot Analysis:** Test User Overtime Display (2026)

---

## Screenshot Values (from Frontend)

| User | Username | Frontend Overtime (2026) |
|------|----------|--------------------------|
| Klaus Ausgeschieden | test.terminated | -80:00h |
| Test User | test.vollzeit | -163:00h |
| Christine Teilzeit | test.christine | -372:00h |
| Peter Fleißig | test.overtime-plus | -1468:00h |
| Max Vollzeit | (original user?) | -1842:00h |
| Sarah Unbezahlt | test.unpaid | -1872:00h |
| Julia Komplex | test.complex | -1896:00h |
| Laura Weniger | test.overtime-minus | -1918:00h |
| Tom Viertage | test.4day-week | -1940:00h |

**Missing from Screenshot:**
- Nina Neuling (test.new2026) - Should show ~0h (hired 2026-01-15)
- Emma Wochenende (test.weekend) - Should show +72h carryover

---

## Comparison with Expected Values (2026-01 only)

### ✅ User 48: Test User (test.vollzeit)

**Frontend:** -163:00h
**Expected (2026-01):** -64h (from TEST_USERS_EXPECTED_VALUES.md)

**Analysis:**
- Frontend shows CUMULATIVE overtime (including 2025 carryover)
- Expected value was calculated for 2026-01 ONLY
- **Discrepancy:** -163h vs -64h = **-99h difference**
- **Possible Cause:** 2025 carryover is included in frontend display

**Status:** ⚠️ Need to check if frontend shows MONTH overtime or CUMULATIVE overtime

---

### ⚠️ User 49: Christine Teilzeit (test.christine)

**Frontend:** -372:00h
**Expected (2026-01):** -4h (from TEST_USERS_EXPECTED_VALUES.md)

**Analysis:**
- **MASSIVE discrepancy:** -372h vs -4h = **-368h difference**
- Expected: Only 3 workdays in Jan (12h vacation credit)
- **Possible Issues:**
  1. Frontend might show cumulative from 2025
  2. workSchedule might not be applied correctly
  3. Vacation credit might not be counted

**Status:** 🔴 **CRITICAL - Requires Investigation**

---

### ❌ User 50: Peter Fleißig (test.overtime-plus)

**Frontend:** -1468:00h
**Expected (2026-01):** +60h carryover from 2025

**Analysis:**
- **Should be POSITIVE** (+60h from 2025)
- Shows heavily negative instead
- **Discrepancy:** -1468h vs +60h = **-1528h ERROR**

**Status:** 🔴 **CRITICAL ERROR - Expected positive overtime, got heavily negative**

---

### ❌ User 51: Laura Weniger (test.overtime-minus)

**Frontend:** -1918:00h
**Expected (2026-01):** -150h carryover from 2025

**Analysis:**
- Expected negative, got MORE negative
- **Discrepancy:** -1918h vs -150h = **-1768h difference**
- Possible issue: 2026 calculations adding MORE negative hours incorrectly

**Status:** 🔴 **CRITICAL - Much worse than expected**

---

### ⚠️ User 52: Sarah Unbezahlt (test.unpaid)

**Frontend:** -1872:00h
**Expected (2025-08):** Unpaid leave test (August 2025, not January)

**Analysis:**
- Frontend shows 2026 value
- Expected values were for 2025-08 (unpaid leave month)
- Cannot directly compare

**Status:** ⚠️ Need to validate against 2025-08 expected values

---

### ⚠️ User 53: Tom Viertage (test.4day-week)

**Frontend:** -1940:00h
**Expected (2026-01):** ~60h for 6 workdays (Mo-Do pattern)

**Analysis:**
- 4-day week (Mo-Do 10h each)
- Expected: 6 days × 10h = 60h target
- **Discrepancy:** -1940h vs expected small negative
- **Issue:** Likely not working any hours in 2026 yet

**Status:** ⚠️ May be correct if no time entries in 2026

---

### ⚠️ User 54: Julia Komplex (test.complex)

**Frontend:** -1896:00h
**Expected (2026-01):** Mixed absences + correction (+5h)

**Analysis:**
- Expected: Various absence types + manual correction
- Shows very negative value
- **Discrepancy:** Significantly worse than expected

**Status:** ⚠️ Requires detailed validation

---

### ⚠️ User 56: Klaus Ausgeschieden (test.terminated)

**Frontend:** -80:00h (**Best value!**)
**Expected:** endDate 2025-12-31, should have NO 2026 data

**Analysis:**
- Shows -80h in 2026 despite endDate 2025-12-31
- **SHOULD NOT HAVE 2026 OVERTIME ENTRY!**
- Carryover from 2025 might exist, but 2026 should be frozen

**Status:** 🔴 **CRITICAL - Terminated employee shows 2026 data**

---

## 🔍 Key Findings

### 🔴 Critical Issues:

1. **Peter Fleißig (User 50):** Should have +60h, shows -1468h
   - Expected positive overtime, got heavily negative
   - Indicates fundamental calculation error

2. **Klaus Ausgeschieden (User 56):** Shows 2026 overtime despite endDate 2025-12-31
   - Terminated employees should NOT accumulate new overtime
   - System not respecting endDate

3. **Christine Teilzeit (User 49):** -372h vs expected -4h
   - workSchedule {monday: 4, tuesday: 4} might not be applied
   - Massive discrepancy suggests weeklyHours (40h) being used instead

### ⚠️ Possible Root Causes:

**Hypothesis 1: Frontend shows CUMULATIVE (2025 + 2026), not just 2026**
- Would explain why all values are much more negative
- But doesn't explain Peter Fleißig being negative instead of positive

**Hypothesis 2: workSchedule not applied in production calculation**
- Christine should work only 2 days/week (8h total)
- If system uses weeklyHours (40h), target would be 5× higher
- Explains massive negative values

**Hypothesis 3: Time entries not seeded for 2026**
- Test users have 2025 data + carryover
- But no 2026 time entries → accumulating negative overtime
- Expected: Some users should have 2026 entries

**Hypothesis 4: endDate not respected**
- Klaus (User 56) should be frozen at 2025-12-31
- But shows -80h in 2026 → system still calculating

---

## 📋 Recommended Actions

### 1. Verify Frontend Display Logic
```bash
# Check if frontend shows monthly or cumulative overtime
grep -r "overtime.*cumulative\|overtime.*total" desktop/src/
```

**Question:** Does the frontend display:
- A) Monthly overtime (just 2026-01)?
- B) Cumulative overtime (2025 carryover + 2026-01)?

### 2. Run Detailed Validation for Critical Users

```bash
# User 50 (Peter Fleißig) - Should be POSITIVE
npm run validate:overtime:detailed -- --userId=50 --month=2026-01

# User 49 (Christine) - workSchedule test
npm run validate:overtime:detailed -- --userId=49 --month=2026-01

# User 56 (Klaus) - endDate test
npm run validate:overtime:detailed -- --userId=56 --month=2026-01
```

### 3. Check Database Directly

```bash
# Check overtime_balance entries for 2026-01
sqlite3 database/development.db "
SELECT u.id, u.username, ob.month, ob.targetHours, ob.actualHours, ob.overtime
FROM users u
LEFT JOIN overtime_balance ob ON u.id = ob.userId AND ob.month = '2026-01'
WHERE u.username LIKE 'test.%'
ORDER BY u.id;
"

# Check if Klaus (User 56) has 2026 entries despite endDate
sqlite3 database/development.db "
SELECT * FROM overtime_balance
WHERE userId = 56 AND month >= '2026-01';
"

# Check Peter's carryover
sqlite3 database/development.db "
SELECT * FROM overtime_transactions
WHERE userId = 50 AND type = 'year_end_rollover'
ORDER BY date DESC LIMIT 5;
"
```

### 4. Verify workSchedule Application

```bash
# Check if Christine's workSchedule is saved correctly
sqlite3 database/development.db "
SELECT id, username, weeklyHours, workSchedule
FROM users
WHERE username = 'test.christine';
"
```

### 5. Check Time Entries for 2026

```bash
# See if test users have ANY 2026 time entries
sqlite3 database/development.db "
SELECT u.username, COUNT(*) as entries_2026
FROM users u
LEFT JOIN time_entries te ON u.id = te.userId AND te.date >= '2026-01-01'
WHERE u.username LIKE 'test.%'
GROUP BY u.id, u.username;
"
```

---

## 🎯 Expected vs Actual Summary Table

| User | Expected OT (2026-01) | Frontend Display | Discrepancy | Status |
|------|----------------------|------------------|-------------|--------|
| Test User (48) | -64h | -163h | -99h | ⚠️ Check cumulative |
| Christine (49) | -4h | -372h | -368h | 🔴 Critical |
| Peter (50) | **+60h** | **-1468h** | **-1528h** | 🔴 Critical Error |
| Laura (51) | -150h | -1918h | -1768h | 🔴 Critical |
| Sarah (52) | (Aug 2025 test) | -1872h | N/A | ⚠️ Wrong month |
| Tom (53) | ~-60h | -1940h | -1880h | ⚠️ Check entries |
| Julia (54) | Mixed | -1896h | N/A | ⚠️ Validate |
| Nina (55) | 0h (new 2026) | NOT IN SCREENSHOT | Missing | 🔴 Missing |
| Klaus (56) | NO 2026 data! | -80h | Invalid | 🔴 endDate violated |
| Emma (57) | +72h | NOT IN SCREENSHOT | Missing | 🔴 Missing |

---

## 🚨 Critical Questions to Answer

1. **Frontend Display:** Monthly or Cumulative overtime?
2. **Peter Fleißig:** Why negative when 2025 carryover was +60h?
3. **Klaus Ausgeschieden:** Why 2026 data exists despite endDate 2025-12-31?
4. **Christine:** Is workSchedule being ignored in production?
5. **Nina & Emma:** Why missing from frontend display?
6. **Time Entries:** Do test users have 2026 time entries, or only 2025?

---

## Next Steps

1. **Run validation commands** (see Section 2 above)
2. **Check database directly** (see Section 3 above)
3. **Compare with seeding script** to verify data was created correctly
4. **Identify if this is:**
   - Frontend display issue (showing wrong timeframe)
   - Backend calculation issue (workSchedule/endDate not respected)
   - Seeding issue (wrong data created)

---

**Generated:** 2026-01-18
**Source:** Frontend screenshot analysis vs TEST_USERS_EXPECTED_VALUES.md
**Priority:** 🔴 CRITICAL - Multiple fundamental issues detected
