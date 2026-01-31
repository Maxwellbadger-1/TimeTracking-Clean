# Test Users - Complete Workflow

**Purpose:** Create and validate comprehensive test users for overtime calculation system

## When to use this command

Use this command when you want to:
- Create a fresh set of test users
- Validate the overtime calculation system
- Test all edge cases (weekend workers, part-time, 4-day weeks, etc.)
- Verify a fix or change to the overtime system

## What this command does

This command will:

1. **Clean existing test users** (User IDs 48-57) from dev database
2. **Create 10 comprehensive test user personas:**
   - User 48: Max Vollzeit (Standard 40h/week)
   - User 49: Christine Teilzeit (Part-time Mon+Tue 4h)
   - User 50: Peter Fleißig (Positive overtime)
   - User 51: Laura Weniger (Negative overtime)
   - User 52: Sarah Unbezahlt (Unpaid leave test)
   - User 53: Tom Viertage (4-day week Mon-Thu 10h)
   - User 54: Julia Komplex (Multiple absences)
   - User 55: Nina Neuling (New hire 2026-01-15)
   - User 56: Klaus Ausgeschieden (Terminated 2025-12-31)
   - User 57: Emma Wochenende (Weekend worker Sat+Sun 8h)
3. **Add 2026 time entries** for realistic testing
4. **Calculate overtime balances** for all users
5. **Validate ALL 10 users** and generate comprehensive report
6. **Show results** with pass/fail status

## Expected Outcome

After running this command, you should see:
- ✅ **10/10 users PASS validation**
- ❌ **0/10 users FAIL**
- Comprehensive validation report at `/server/VALIDATION_ALL_USERS_REPORT.md`

## Files Created/Updated

1. `/server/database/development.db` - Test users 48-57
2. `/server/VALIDATION_ALL_USERS_REPORT.md` - Validation results
3. Console output with detailed pass/fail status

## Available Scripts

After this command, you can also manually run:

```bash
# Individual validation
npm run validate:overtime:detailed -- --userId=48 --month=2026-01

# Validate all test users
npm run validate:all-test-users

# Recalculate overtime
npm run recalculate:overtime

# Recreate test users
npm run seed:test-users

# Add more 2026 entries
npm run add:2026-entries
```

## Troubleshooting

If validation fails:
1. Check `/server/ROOT_CAUSE_ANALYSIS.md` for common issues
2. Run `npm run validate:overtime:detailed -- --userId=<ID>` for detailed breakdown
3. Verify production code hasn't regressed in `/server/src/services/overtimeService.ts`

## Implementation Instructions

When I (Claude) execute this command, I should:

1. **Delete existing test users:**
   ```sql
   DELETE FROM users WHERE id BETWEEN 48 AND 57;
   DELETE FROM time_entries WHERE userId BETWEEN 48 AND 57;
   DELETE FROM absence_requests WHERE userId BETWEEN 48 AND 57;
   DELETE FROM overtime_balance WHERE userId BETWEEN 48 AND 57;
   DELETE FROM vacation_balance WHERE userId BETWEEN 48 AND 57;
   DELETE FROM overtime_transactions WHERE userId BETWEEN 48 AND 57;
   DELETE FROM overtime_corrections WHERE userId BETWEEN 48 AND 57;
   ```

2. **Create test users:**
   ```bash
   npm run seed:test-users
   ```

3. **Add 2026 time entries:**
   ```bash
   npm run add:2026-entries
   ```

4. **Recalculate overtime:**
   ```bash
   npm run recalculate:overtime
   ```

5. **Validate all users:**
   ```bash
   npm run validate:all-test-users
   ```

6. **Analyze results:**
   - Read `/server/VALIDATION_ALL_USERS_REPORT.md`
   - Show summary to user
   - If any failures, investigate with detailed validation

7. **Clean up reports (optional):**
   - Keep VALIDATION_ALL_USERS_REPORT.md (latest results)
   - Keep FINAL_REPORT.md (documentation)
   - Keep ROOT_CAUSE_ANALYSIS.md (reference)

## Success Criteria

- ✅ All 10 users created successfully
- ✅ All 10 users have time entries for 2026-01
- ✅ All 10 users have calculated overtime balances
- ✅ **10/10 users PASS validation**
- ✅ Report shows 0 discrepancies

## Edge Cases Tested

This test suite covers:
- ✅ Standard work weeks (40h/5 days)
- ✅ Individual work schedules (workSchedule field)
- ✅ Weekend workers (Sat+Sun)
- ✅ 4-day work weeks (longer days)
- ✅ Part-time employees
- ✅ Vacation, sick leave, overtime compensation
- ✅ Unpaid leave (reduces target)
- ✅ Public holidays (Bayern)
- ✅ Hire dates (partial months)
- ✅ End dates (terminated employees)
- ✅ Year-end rollover
- ✅ Positive and negative overtime

---

**Last Updated:** 2026-01-18
**Status:** ✅ Fully functional
**Validation:** 10/10 users pass
