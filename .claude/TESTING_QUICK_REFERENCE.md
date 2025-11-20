# Testing Quick Reference

## Quick Test Commands

```bash
# Run all tests (frontend + backend)
npm run test:run

# Run frontend tests only
npm run test:desktop

# Run backend tests only
npm run test:server

# Watch mode (auto-rerun on file changes)
npm test

# Interactive UI (recommended for development)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Results Summary

- **Total Tests:** 86 passing
- **Frontend Tests:** 50 passing (3 test files)
- **Backend Tests:** 36 passing (1 test file)
- **Coverage:** 100% for core utilities

## Key Test Files

### Frontend (Desktop)
1. `/desktop/src/utils/timeUtils.test.ts` - 17 tests
   - formatHours negative number bug (REGRESSION TEST)
   - Time calculations, formatting, overnight shifts

2. `/desktop/src/hooks/useAggregatedOvertimeStats.test.ts` - 10 tests
   - "Alle Mitarbeiter" aggregation bug (REGRESSION TEST)
   - Multi-user overtime aggregation logic

3. `/desktop/src/test/overtimeCalculation.test.ts` - 23 tests
   - Complete overtime calculation logic
   - Nov 7-11, 2025 real-world scenario
   - Absence credits, working days, part-time employees

### Backend (Server)
1. `/server/src/utils/workingDays.test.ts` - 36 tests
   - Working days calculation (excluding weekends/holidays)
   - Target hours calculation from hire date to today
   - Performance tests (5+ year date ranges)

## Critical Regression Tests

### 1. formatHours Negative Bug ✅ FIXED
```typescript
// Test: formatHours(-23.5) should return "-23:30h"
// Before: "-24:-30h" ❌
// After:  "-23:30h"  ✅
```

### 2. "Alle Mitarbeiter" Aggregation ✅ FIXED
```typescript
// Test: Aggregate 3 users overtime
// Before: Showed individual user data ❌
// After:  Properly aggregates all users ✅
```

### 3. Working Days (Nov 7-11) ✅ VERIFIED
```typescript
// Test: countWorkingDaysBetween('2025-11-07', '2025-11-11')
// Expected: 3 (Thu, Fri, Mon - weekend excluded)
// Result:   3 ✅
```

## Test Coverage

- ✅ Time utilities (formatHours, calculateHours, etc.)
- ✅ Overtime calculation logic
- ✅ Working days calculation
- ✅ Aggregation logic
- ✅ Absence credits (sick/vacation)
- ✅ Unpaid leave handling
- ✅ Part-time employees
- ✅ Edge cases (weekend hire dates, year boundaries)

## Next Steps

To add more tests:
1. Copy existing test structure from test files
2. Follow naming convention: `*.test.ts`
3. Run `npm run test:ui` for interactive development
4. Ensure tests pass before committing

## Test Philosophy

**ALWAYS test:**
- Business logic bugs that reached production
- Edge cases that caused issues
- Critical calculations (money, time, overtime)
- Aggregation logic (multi-user scenarios)

**DON'T test:**
- Third-party library internals
- Simple getters/setters without logic
- Generated code

## Links

- Full documentation: `/TESTING.md`
- Test utilities: `/desktop/src/test/utils.tsx`
- Test setup: `/desktop/src/test/setup.ts`
