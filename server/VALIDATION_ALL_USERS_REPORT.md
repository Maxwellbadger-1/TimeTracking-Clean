# Validation Report: All Test Users

**Date:** 2026-01-19
**Month:** 2026-01

## Summary

- ✅ PASS: 8/10
- ❌ FAIL: 2/10
- ⚠️  NO DATA: 0/10

## Issues Found

### User 141: Christine Teilzeit

**Status:** ❌ FAIL

**Issues:**
- Actual Hours Mismatch: Expected 20h, DB 24h (Δ -4.00h)
- Overtime Mismatch: Expected +4h, DB +8h (Δ -4.00h)

**Details:**
- Expected Target: 16h
- DB Target: 16h
- Expected Actual: 20h
- DB Actual: 24h
- Expected Overtime: +4h
- DB Overtime: +8h

---

### User 147: Nina Neuling

**Status:** ❌ FAIL

**Issues:**
- Target Hours Mismatch: Expected 16h, DB 24h (Δ -8.00h)
- Overtime Mismatch: Expected +16h, DB +8h (Δ 8.00h)

**Details:**
- Expected Target: 16h
- DB Target: 24h
- Expected Actual: 32h
- DB Actual: 32h
- Expected Overtime: +16h
- DB Overtime: +8h

---

## All Results

### ✅ User 140: Max Vollzeit

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 88h | 88h | ✅ |
| Actual Hours | 40h | 40h | ✅ |
| Overtime | -48h | -48h | ✅ |

### ❌ User 141: Christine Teilzeit

**Status:** FAIL

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 16h | 16h | ✅ |
| Actual Hours | 20h | 24h | ❌ |
| Overtime | +4h | +8h | ❌ |

### ✅ User 142: Peter Fleißig

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 88h | 88h | ✅ |
| Actual Hours | 45h | 45h | ✅ |
| Overtime | -43h | -43h | ✅ |

### ✅ User 143: Laura Weniger

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 88h | 88h | ✅ |
| Actual Hours | 26h | 26h | ✅ |
| Overtime | -62h | -62h | ✅ |

### ✅ User 144: Sarah Unbezahlt

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 88h | 88h | ✅ |
| Actual Hours | 16h | 16h | ✅ |
| Overtime | -72h | -72h | ✅ |

### ✅ User 145: Tom Viertage

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 80h | 80h | ✅ |
| Actual Hours | 30h | 30h | ✅ |
| Overtime | -50h | -50h | ✅ |

### ✅ User 146: Julia Komplex

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 88h | 88h | ✅ |
| Actual Hours | 16h | 16h | ✅ |
| Overtime | -72h | -72h | ✅ |

### ❌ User 147: Nina Neuling

**Status:** FAIL

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 16h | 24h | ❌ |
| Actual Hours | 32h | 32h | ✅ |
| Overtime | +16h | +8h | ❌ |

### ✅ User 148: Klaus Ausgeschieden

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 88h | 88h | ✅ |
| Actual Hours | 0h | 0h | ✅ |
| Overtime | -88h | -88h | ✅ |

### ✅ User 149: Emma Wochenende

**Status:** PASS

| Metric | Expected | Database | Match |
|--------|----------|----------|-------|
| Target Hours | 48h | 48h | ✅ |
| Actual Hours | 32h | 32h | ✅ |
| Overtime | -16h | -16h | ✅ |

