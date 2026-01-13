# Playwright E2E Tests - TimeTracking System

## Overview

Comprehensive End-to-End tests for the TimeTracking Desktop App, covering all user management functionality.

## Test Suites

### 1. User Creation Tests (`user-creation.spec.ts`)
Tests all scenarios for creating new employees:
- ✅ Normal values (40h, 30 vacation days)
- ✅ **Zero values (0h, 0 vacation days)** - Critical bug test
- ✅ Without email
- ✅ Multiple users without email (UNIQUE constraint test)
- ✅ Part-time hours (20h)
- ✅ Validation: Without username
- ✅ Validation: Invalid email
- ✅ Validation: Duplicate username

### 2. User Edit Tests (`user-edit.spec.ts`)
Tests all scenarios for editing existing employees:
- ✅ **Edit employee without email** - Critical bug test (was crashing)
- ✅ Remove email from employee
- ✅ **Change to 0 hours** - Critical bug test
- ✅ **Switch from workSchedule to normal hours** - Critical bug test
- ✅ Deactivate and reactivate employee
- ✅ Set end date
- ✅ Change role (employee → admin)

### 3. Edge Case Tests (`edge-cases.spec.ts`)
Tests boundary conditions and edge cases:
- ✅ Maximum values (60h, 50 vacation days)
- ✅ Future hire dates
- ✅ Very long names
- ✅ Special characters in names (Umlauts, apostrophes)
- ✅ Decimal hours (19.5h)
- ✅ Validation: Password too short
- ✅ Validation: Username too short
- ✅ Validation: Password mismatch

## Prerequisites

**IMPORTANT:** Before running tests, ensure:

1. **Backend Server is running** on `http://localhost:3000`
   ```bash
   cd ../server
   npm start
   ```

2. **Desktop Dev Server is running** on `http://localhost:1420`
   ```bash
   npm run dev
   # OR
   npm run tauri:dev
   ```

3. **Admin user exists** with credentials:
   - Username: `admin`
   - Password: `admin`

## Running Tests

### Run All Tests (Headless)
```bash
npm run test:e2e
```

### Run Tests with UI (Interactive)
```bash
npm run test:e2e:ui
```

### Run Tests in Debug Mode
```bash
npm run test:e2e:debug
```

### Run Specific Test File
```bash
npx playwright test user-creation
npx playwright test user-edit
npx playwright test edge-cases
```

### View Test Report
```bash
npm run test:e2e:report
```

## Test Configuration

- **Base URL:** `http://localhost:1420` (Tauri Dev Server)
- **Workers:** 1 (Sequential execution to avoid database conflicts)
- **Timeout:** 10s per action, 30s for navigation
- **Retries:** 0 in dev, 2 in CI
- **Screenshots:** Only on failure
- **Video:** Only on failure
- **Trace:** Retained on failure

## Test Strategy

### Sequential Execution
Tests run **one at a time** (`workers: 1`) to prevent database conflicts when multiple tests try to create/edit/delete users simultaneously.

### Database State
Each test creates its own test users with unique usernames to avoid conflicts. Tests do NOT clean up after themselves (test users remain in database for manual inspection).

### Auth Fixture
Reusable authentication helper (`fixtures/auth.ts`):
- `loginAsAdmin(page)` - Login as admin user
- `navigateToUsers(page)` - Navigate to users page
- `deleteUserByUsername(page, username)` - Delete test user (optional cleanup)

## Critical Bug Tests

The following tests specifically verify fixes for reported bugs:

1. **Edit employee without email** (`user-edit.spec.ts`)
   - **Bug:** Application crashed when editing employee without email
   - **Fix:** Handle NULL email values with `user.email || ''`

2. **Create/Edit employee with 0 hours** (`user-creation.spec.ts`, `user-edit.spec.ts`)
   - **Bug:** 0 hours converted to 40 hours on save
   - **Fix:** Use `!== ''` check instead of `|| 40`

3. **Switch from workSchedule to normal hours** (`user-edit.spec.ts`)
   - **Bug:** Couldn't clear individual workSchedule
   - **Fix:** Explicitly send `null` instead of `undefined`

## Debugging Failed Tests

### Check Screenshots
Failed tests save screenshots to `test-results/`:
```bash
open test-results/
```

### Check Trace
Failed tests save execution traces:
```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

### Check Server Logs
If tests fail, check backend server logs:
```bash
tail -f /tmp/server.log
```

### Check Desktop Console
If tests fail, check browser console in Tauri Dev Server (F12).

## Common Issues

### Tests Timeout
- **Cause:** Desktop Dev Server not running
- **Fix:** Start dev server with `npm run dev`

### Login Fails
- **Cause:** Admin user doesn't exist or wrong credentials
- **Fix:** Check database has admin user with password "admin"

### Database Conflicts
- **Cause:** Tests running in parallel
- **Fix:** Already configured with `workers: 1`, should not happen

### Vite Cache Issues
- **Cause:** Old JavaScript code cached despite source changes
- **Fix:**
  ```bash
  rm -rf node_modules/.vite
  npm run dev
  # Hard refresh browser: Cmd+Shift+R
  ```

## Next Steps

1. **Run tests manually** to verify all functionality works
2. **Add to CI/CD** pipeline (GitHub Actions)
3. **Extend tests** for time entries, absence requests, etc.
4. **Add cleanup** logic if database grows too large with test users

## Test Coverage Summary

- **User Creation:** 8 scenarios
- **User Edit:** 7 scenarios
- **Edge Cases:** 8 scenarios
- **TOTAL:** 23 comprehensive test cases

All critical bugs from user reports are covered! ✅
