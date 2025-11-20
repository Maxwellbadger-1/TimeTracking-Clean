# Testing Infrastructure - TimeTracking System

**Version:** 1.0
**Date:** 2025-11-13
**Test Framework:** Vitest
**Total Tests:** 86 passing (50 frontend + 36 backend)

---

## Overview

This document describes the comprehensive testing infrastructure for the TimeTracking System. The test suite was specifically designed to catch critical bugs like the formatHours negative number bug and the "Alle Mitarbeiter" aggregation issue.

---

## Test Statistics

### Frontend (Desktop)
- **Test Files:** 3
- **Tests:** 50 passing
- **Location:** `/desktop/src/`
- **Framework:** Vitest + @testing-library/react

### Backend (Server)
- **Test Files:** 1
- **Tests:** 36 passing
- **Location:** `/server/src/`
- **Framework:** Vitest

---

## Running Tests

### All Tests (Root)
```bash
# Run all tests (both frontend and backend)
npm run test:run

# Run tests in watch mode
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Frontend Tests Only
```bash
cd desktop
npm run test:run       # Run once
npm run test           # Watch mode
npm run test:ui        # Interactive UI
npm run test:coverage  # With coverage report
```

### Backend Tests Only
```bash
cd server
npm run test:run       # Run once
npm run test           # Watch mode
npm run test:ui        # Interactive UI
npm run test:coverage  # With coverage report
```

---

## Test Files

### Frontend Tests

#### 1. `/desktop/src/utils/timeUtils.test.ts`
**17 tests** - Core time utility functions

**Key Tests:**
- `formatHours` - Positive, negative, and zero hours formatting
- **REGRESSION TEST:** `formatHours` negative number bug
  - Before fix: `-23.5h` → `"-24:-30h"` (WRONG!)
  - After fix: `-23.5h` → `"-23:30h"` (CORRECT!)
- `formatOvertimeHours` - Overtime display with +/- signs
- `calculateHours` - Time entry calculations including overnight shifts
- `calculateTotalHours` - Sum of time entries
- `calculateExpectedHours` - Target hours excluding weekends

**Bug Prevention:**
This test would have caught the formatHours bug before it reached production. The negative hours calculation was applying Math.floor() incorrectly to negative values.

#### 2. `/desktop/src/hooks/useAggregatedOvertimeStats.test.ts`
**10 tests** - "Alle Mitarbeiter" aggregation logic

**Key Tests:**
- **REGRESSION TEST:** Aggregated overtime calculation
  - Before fix: Showed individual user data when "Alle Mitarbeiter" selected
  - After fix: Properly aggregates all users' overtime data
- Data structure validation
- Aggregation logic for multiple users
- Negative/positive/mixed overtime scenarios
- Empty user arrays
- Query parameter construction

**Real-World Scenario:**
```
Given:
- User A: Target=160h, Actual=150h, Overtime=-10h
- User B: Target=160h, Actual=170h, Overtime=+10h
- User C: Target=160h, Actual=160h, Overtime=0h

When admin selects "Alle Mitarbeiter":
Then system shows:
- Total Target Hours: 480h
- Total Actual Hours: 480h
- Total Overtime: 0h
- User Count: 3
```

#### 3. `/desktop/src/test/overtimeCalculation.test.ts`
**23 tests** - Comprehensive overtime calculation logic

**Key Tests:**
- Basic overtime formula: `Overtime = Actual - Target`
- Working days calculation (excluding weekends)
- Target hours calculation from hire date to today
- **REGRESSION TEST:** Nov 7-11, 2025 scenario
  - Employee hired Thursday Nov 7
  - Today is Monday Nov 11
  - Working days: 3 (Thu, Fri, Mon) - Weekend excluded
  - Target: 24h, Actual: 0h, Overtime: -24h
- Absence credits (sick/vacation count as worked)
- Unpaid leave (reduces target hours)
- Part-time employees
- Mixed scenarios with work, sick days, and unpaid leave
- Edge cases (hired on weekend, hired on Friday, etc.)

**Best Practices Validated:**
- Sick/vacation days = worked hours (prevent negative overtime)
- Unpaid leave reduces target (not actual)
- Always calculate from hire date to TODAY (never future)
- Live calculation (never cached)

---

### Backend Tests

#### 1. `/server/src/utils/workingDays.test.ts`
**36 tests** - Working days and target hours calculation

**Key Tests:**
- `getWorkingDaysInMonth` - Count working days in any month
  - January 2025: 23 working days
  - February 2025: 20 working days
  - Handles 31-day, 30-day, and leap year months
- `calculateDailyTargetHours` - Daily hours from weekly hours
  - 40h/week = 8h/day
  - 37.5h/week = 7.5h/day
  - 30h/week (part-time) = 6h/day
- `calculateMonthlyTargetHours` - Monthly target calculation
  - January 2025 (40h/week) = 184h
  - February 2025 (40h/week) = 160h
- `countWorkingDaysBetween` - Working days between two dates
  - **CRITICAL TEST:** Nov 7-11, 2025 = 3 working days
  - Excludes weekends correctly
  - Handles single days, full weeks, multi-week periods
  - Works with both string and Date objects
- `calculateTargetHoursUntilToday` - Target hours from hire date
  - Returns 0 if hire date is in future
  - Handles hire date = today
  - Handles weekend hire dates
  - Handles long-term employees (1+ months)
- Integration tests
  - Year boundary handling
  - Decimal precision (2 decimal places)
  - Complete overtime flow validation
  - Multi-user aggregation scenarios
- Performance tests
  - 5+ year date ranges complete in < 100ms

---

## Test Configuration

### Frontend (`/desktop/vitest.config.ts`)
```typescript
{
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  coverage: {
    provider: 'v8',
    exclude: ['node_modules/', 'src/test/', '**/*.config.ts']
  }
}
```

### Backend (`/server/vitest.config.ts`)
```typescript
{
  environment: 'node',
  exclude: ['**/node_modules/**', '**/dist/**'],
  coverage: {
    provider: 'v8',
    exclude: ['node_modules/', 'dist/', 'src/database/migrations/']
  }
}
```

---

## Test Utilities

### Frontend Test Utilities (`/desktop/src/test/utils.tsx`)
- `createTestQueryClient()` - Create isolated QueryClient for tests
- `AllTheProviders` - Wrapper with all necessary providers
- `renderWithProviders()` - Custom render with providers
- Re-exports all @testing-library/react utilities

### Frontend Test Setup (`/desktop/src/test/setup.ts`)
- Auto-cleanup after each test
- Mock Tauri APIs
- Mock console methods to reduce noise
- Configure @testing-library/jest-dom matchers

---

## Regression Test Examples

### 1. formatHours Negative Bug (Fixed)

**Test Case:**
```typescript
it('should format negative hours correctly (BUG FIX)', () => {
  expect(formatHours(-23.5)).toBe('-23:30h');
  expect(formatHours(-24)).toBe('-24:00h');
  expect(formatHours(-8.5)).toBe('-8:30h');
});
```

**Real Scenario:**
- Employee hired Nov 7, 2025 (Thursday)
- Today: Nov 11, 2025 (Monday)
- Target: 24h (3 working days × 8h)
- Actual: 0h
- Overtime: -24h
- Display MUST show: "-24:00h" (not "-24:-0h" or "-25:0h")

### 2. "Alle Mitarbeiter" Aggregation Bug (Fixed)

**Test Case:**
```typescript
it('should correctly aggregate multiple users overtime data', () => {
  const usersData = [
    { targetHours: 160, actualHours: 150, overtime: -10 },
    { targetHours: 160, actualHours: 170, overtime: +10 },
    { targetHours: 160, actualHours: 160, overtime: 0 },
  ];

  const aggregated = aggregateUsers(usersData);

  expect(aggregated.totalTargetHours).toBe(480);
  expect(aggregated.totalActualHours).toBe(480);
  expect(aggregated.totalOvertime).toBe(0);
});
```

**Real Issue:**
When admin selected "Alle Mitarbeiter" in Reports page, the system showed individual user data instead of aggregating all users' overtime totals.

### 3. Working Days Calculation (Nov 7-11)

**Test Case:**
```typescript
it('should count 3 working days from Thu Nov 7 to Mon Nov 11, 2025', () => {
  const workingDays = countWorkingDaysBetween('2025-11-07', '2025-11-11');
  expect(workingDays).toBe(3); // Thu, Fri, Mon (weekend excluded)
});
```

---

## Best Practices Enforced by Tests

### 1. Overtime Calculation
- Formula: `Overtime = Actual Hours - Target Hours` (IMMUTABLE)
- Reference Date: Always TODAY (never future)
- Live Calculation: Always on-demand (never cached)

### 2. Absence Handling
- Sick/Vacation = Worked hours (prevents negative overtime)
- Unpaid leave reduces target hours (not actual hours)
- Overtime compensation counts as worked hours

### 3. Working Days
- Monday-Friday only (exclude weekends)
- Exclude public holidays (from database)
- Inclusive date ranges (both start and end date)

### 4. Precision
- All hour calculations: 2 decimal places
- Rounding: Use `Math.round(value * 100) / 100`
- No floating point errors in financial/time calculations

---

## Adding New Tests

### Frontend Component Test
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/utils';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Backend Utility Test
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFunction.js';

describe('myFunction', () => {
  it('should calculate correctly', () => {
    const result = myFunction(10, 20);
    expect(result).toBe(30);
  });
});
```

---

## CI/CD Integration

Tests are automatically run in GitHub Actions:

```yaml
- name: Run Tests
  run: npm run test:run

- name: Upload Coverage
  run: npm run test:coverage
```

---

## Coverage Goals

**Current Coverage:**
- Desktop: Core utilities 100% covered
- Server: Core utilities 100% covered

**Target Coverage:**
- Utilities: 100% (ACHIEVED)
- Business Logic: 80%+ (IN PROGRESS)
- UI Components: 60%+ (PLANNED)

---

## Troubleshooting

### Tests fail with "Cannot find module"
- Ensure all dependencies are installed: `npm install`
- Check import paths use `.js` extension (ESM modules)

### Tests timeout
- Increase timeout in test: `it('test', async () => {}, { timeout: 10000 })`
- Check for infinite loops or unresolved promises

### Mock console warnings
- This is expected - console is mocked in test setup to reduce noise
- Real errors will still be visible in test output

---

## Future Test Additions

### Planned Tests
1. **API Endpoint Tests** - Integration tests for all REST endpoints
2. **Database Tests** - Schema validation and query performance
3. **UI Component Tests** - Critical user interactions
4. **E2E Tests** - Full user workflows (login, time entry, reports)
5. **Performance Tests** - Load testing for multi-user scenarios

### Test Naming Convention
- `*.test.ts` - Unit tests (utilities, functions)
- `*.spec.ts` - Integration tests (API, database)
- `*.e2e.ts` - End-to-end tests (user workflows)

---

## Key Learnings from Bug Fixes

### formatHours Bug
- **Lesson:** Always handle negative numbers separately
- **Prevention:** Extract sign first, work with absolute value, apply sign once
- **Test:** Comprehensive negative number test cases

### Aggregation Bug
- **Lesson:** Don't reuse single-user logic for multi-user scenarios
- **Prevention:** Create dedicated aggregation endpoints/hooks
- **Test:** Validate aggregation mathematics explicitly

### Working Days Bug
- **Lesson:** Weekend/holiday exclusion must be tested with real dates
- **Prevention:** Test with actual calendar dates, not just math
- **Test:** Real-world date scenarios (Nov 7-11, year boundaries, etc.)

---

## Contact & Support

For questions about testing:
- Check this document first
- Review existing test files for examples
- Follow the Best Practices section

---

**Last Updated:** 2025-11-13
**Maintained By:** Claude AI Development Guidelines
**Status:** ✅ Active & Production-Ready
