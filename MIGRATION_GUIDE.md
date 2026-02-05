# System Inconsistency Fix - DEVELOPMENT-FIRST Migration Guide

**Document Version:** 2.0.0
**Created:** 2026-02-05
**Purpose:** Safe development and testing guide for fixing critical system inconsistencies
**Timeline:** Development in Week 06-10/2026, Production deployment only after COMPLETE testing

## ⚠️ CRITICAL: Production Safety Rules

**ABSOLUTE RULES:**
1. **NO CHANGES to production database** until ALL phases complete
2. **NO PUSHES to main branch** until fully tested
3. **NO PARTIAL DEPLOYMENTS** - everything ships together
4. **PRODUCTION IS LIVE** - Customer is actively using it!

**Development Strategy:**
- ✅ Work in feature branch: `fix/system-inconsistencies`
- ✅ Use local development database (copy of production)
- ✅ Complete ALL fixes before any production deployment
- ✅ Extensive testing required before merge to main
- ✅ Single "Big Bang" release after full validation

---

## 📋 Development Environment Setup

### Step 1: Create Safe Development Branch
```bash
# Create feature branch for ALL fixes
git checkout -b fix/system-inconsistencies
git push -u origin fix/system-inconsistencies

# NEVER work on main!
```

### Step 2: Setup Local Test Database
```bash
# Get anonymized copy of production database
scp ubuntu@129.159.8.19:/home/ubuntu/TimeTracking-Clean/server/database.db ./server/database_prod_backup.db

# Create development database
cp server/database_prod_backup.db server/database_dev.db

# Use development database locally
export DATABASE_PATH=./database_dev.db
```

### Step 3: Create Test Data Set
```bash
# Create consistent test users for validation
npm run create-test-users -- --dev-db

# Document baseline metrics
npm run validate:overtime:detailed -- --all > baseline_development.txt
```

---

## 🔄 Complete Development Workflow

All phases will be completed in the feature branch BEFORE any production deployment:

```
Week 6-7: Development & Implementation
├── Phase 1: Timezone Fixes
├── Phase 2: UnifiedOvertimeService
├── Phase 3: TransactionManager
├── Phase 4: Database Schema
└── Phase 5: Type Safety

Week 8-9: Testing & Validation
├── Unit Tests (100% coverage)
├── Integration Tests
├── Performance Tests
└── User Acceptance Testing

Week 10: Production Deployment (SINGLE RELEASE)
└── Deploy all changes together
```

---

## Phase 1: Timezone Fixes (Development Only) 🔴 CRITICAL

### ⚠️ REMEMBER: Work in feature branch, use dev database!

### Objective
Fix timezone bugs causing date miscalculations in 17 files.

### Step 1: Create Baseline (Development DB)
```bash
# Make sure you're on feature branch
git branch  # Should show: * fix/system-inconsistencies

# Use development database
export DATABASE_PATH=./database_dev.db

# Document current state for comparison
cd server
npm run validate:overtime:detailed -- --userId=1 > baseline_before_timezone_fix_dev.txt
npm run validate:overtime:detailed -- --userId=5 >> baseline_before_timezone_fix_dev.txt
npm run validate:overtime:detailed -- --userId=155 >> baseline_before_timezone_fix_dev.txt
```

### Step 2: Run Automated Fix Script
```bash
# Create the fix script
cat > scripts/fix-timezone-bugs.ts << 'EOF'
import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';

async function fixTimezoneBugs() {
  const files = await glob('server/**/*.ts', { ignore: ['**/node_modules/**'] });
  let fixedCount = 0;

  for (const file of files) {
    let content = await readFile(file, 'utf-8');
    const original = content;

    // Pattern 1: new Date().toISOString().split('T')[0]
    content = content.replace(
      /new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g,
      "formatDate(getCurrentDate(), 'yyyy-MM-dd')"
    );

    // Pattern 2: variable.toISOString().split('T')[0]
    content = content.replace(
      /(\w+)\.toISOString\(\)\.split\('T'\)\[0\]/g,
      "formatDate($1, 'yyyy-MM-dd')"
    );

    if (content !== original) {
      // Add import if needed
      if (!content.includes("import { formatDate") &&
          !content.includes("from '../utils/timezone")) {
        const importRegex = /^(import .* from .*;?\n)+/m;
        if (importRegex.test(content)) {
          content = content.replace(importRegex, (match) =>
            match + "import { formatDate, getCurrentDate } from '../utils/timezone.js';\n"
          );
        } else {
          content = "import { formatDate, getCurrentDate } from '../utils/timezone.js';\n\n" + content;
        }
      }

      await writeFile(file, content);
      console.log(`✅ Fixed: ${file}`);
      fixedCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} files`);
}

fixTimezoneBugs().catch(console.error);
EOF

# Run the fix
npx tsx scripts/fix-timezone-bugs.ts
```

### Step 3: Manual Verification
Check these specific files for correct fixes:
- `server/src/services/reportService.ts` (Line 110)
- `server/src/services/overtimeLiveCalculationService.ts` (Line 46)
- `server/src/services/timeEntryService.ts` (multiple locations)
- `server/src/routes/overtime.ts` (Line 289)

### Step 4: Test & Validate (Development Only)
```bash
# Still in development environment!
cd server && npx tsc --noEmit

# Run tests with dev database
npm test

# Validate overtime calculations in dev
npm run validate:overtime:detailed -- --userId=1 > baseline_after_timezone_fix_dev.txt
npm run validate:overtime:detailed -- --userId=5 >> baseline_after_timezone_fix_dev.txt
npm run validate:overtime:detailed -- --userId=155 >> baseline_after_timezone_fix_dev.txt

# Compare results
diff baseline_before_timezone_fix_dev.txt baseline_after_timezone_fix_dev.txt
```

### Step 5: Commit to Feature Branch
```bash
# Commit to FEATURE BRANCH only!
git add .
git commit -m "fix: Replace toISOString().split('T')[0] with formatDate() - fixes timezone bugs in 17 files"
git push origin fix/system-inconsistencies

# DO NOT MERGE TO MAIN YET!
```

### ✅ Phase 1 Complete - Continue with Phase 2 in same branch

---

## Phase 2: Unified Overtime Service (Development Only)

### ⚠️ Continue in same feature branch!

### Objective
Implement UnifiedOvertimeService to eliminate dual calculation system.

### Step 1: Create UnifiedOvertimeService
```typescript
// server/src/services/unifiedOvertimeService.ts
import { getDailyTargetHours } from '../utils/workingDays.js';
import { formatDate } from '../utils/timezone.js';
import db from '../database.js';

export class UnifiedOvertimeService {
  private static instance: UnifiedOvertimeService;

  static getInstance(): UnifiedOvertimeService {
    if (!this.instance) {
      this.instance = new UnifiedOvertimeService();
    }
    return this.instance;
  }

  calculateDailyOvertime(userId: number, date: string): DailyOvertimeResult {
    // SINGLE SOURCE OF TRUTH for calculation
    const user = this.getUser(userId);
    const targetHours = getDailyTargetHours(user, date);

    // Get worked hours
    const workedHours = this.getWorkedHours(userId, date);

    // Get absence credits
    const absenceCredit = this.getAbsenceCredit(userId, date);

    // Get corrections
    const corrections = this.getCorrections(userId, date);

    // SINGLE FORMULA (never duplicated)
    const actualHours = workedHours + absenceCredit + corrections;
    const overtime = actualHours - targetHours;

    return {
      date,
      targetHours,
      actualHours,
      overtime,
      breakdown: {
        worked: workedHours,
        absenceCredit,
        corrections
      }
    };
  }

  // ... additional methods
}

export const unifiedOvertimeService = UnifiedOvertimeService.getInstance();
```

### Step 2: Replace All Calculation Paths
```typescript
// server/src/services/reportService.ts
import { unifiedOvertimeService } from './unifiedOvertimeService.js';

function calculateDailyBreakdown(userId: number, date: string) {
  // REPLACE completely - no feature flags needed
  return unifiedOvertimeService.calculateDailyOvertime(userId, date);
}

// Do the same for:
// - overtimeService.ts
// - overtimeLiveCalculationService.ts
// ALL must use UnifiedOvertimeService
```

### Step 3: Development Testing
```typescript
// Create test script to verify all services produce same results
// server/src/test/verifyUnifiedService.ts

async function verifyAllCalculationsMatch() {
  const testUsers = [1, 5, 155];
  const testDates = ['2026-01-01', '2026-01-15', '2026-01-31'];

  for (const userId of testUsers) {
    for (const date of testDates) {
      const result = unifiedOvertimeService.calculateDailyOvertime(userId, date);
      console.log(`User ${userId}, Date ${date}: ${result.overtime}h`);
      // Store results for comparison
    }
  }
}
```

### Step 4: Test Coverage in Development
```bash
# Create comprehensive test suite
npm test -- unifiedOvertimeService

# Verify no regressions
npm run test:overtime:all

# Compare with baseline
npm run validate:overtime:detailed -- --all > after_unified_service.txt
diff baseline_development.txt after_unified_service.txt
```

### Step 5: Commit to Feature Branch
```bash
git add .
git commit -m "feat: Implement UnifiedOvertimeService for consistent calculations"
git push origin fix/system-inconsistencies

# Still NO merge to main!
```

---

## Phase 3: Transaction Deduplication (Development Only)

### ⚠️ Continue in same feature branch!

### Objective
Centralize transaction creation to prevent duplicates.

### Step 1: Create OvertimeTransactionManager
```typescript
// server/src/services/overtimeTransactionManager.ts
export class OvertimeTransactionManager {
  createTransaction(params: TransactionParams): void {
    // Check for duplicates FIRST
    const existing = this.findDuplicate(params);
    if (existing) {
      console.log(`Transaction exists: ${existing.id}`);
      return; // Idempotent
    }

    // Create transaction with audit trail
    db.prepare(`
      INSERT INTO overtime_transactions
      (userId, date, type, hours, referenceType, referenceId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(/* params */);
  }

  private findDuplicate(params): Transaction | null {
    return db.prepare(`
      SELECT * FROM overtime_transactions
      WHERE userId = ? AND date = ? AND type = ?
        AND ABS(hours - ?) < 0.001
        AND referenceId = ?
    `).get(/* params */);
  }
}
```

### Step 2: Migrate Transaction Creation
Replace all direct INSERT statements:
```typescript
// BEFORE
db.prepare('INSERT INTO overtime_transactions...').run();

// AFTER
transactionManager.createTransaction({ /* params */ });
```

### Step 3: Add Database Constraints
```sql
-- Migration: 003_add_transaction_uniqueness.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_overtime_transactions_unique
ON overtime_transactions(userId, date, type, referenceId)
WHERE referenceId IS NOT NULL;
```

---

## Phase 4: Database Schema Updates (Week 9)

### Add Balance Tracking Columns
```sql
-- Migration: 004_add_balance_tracking.sql
ALTER TABLE overtime_transactions
ADD COLUMN balanceBefore REAL DEFAULT NULL;

ALTER TABLE overtime_transactions
ADD COLUMN balanceAfter REAL DEFAULT NULL;

-- Backfill historical data
UPDATE overtime_transactions
SET balanceBefore = (
  SELECT COALESCE(SUM(hours), 0)
  FROM overtime_transactions t2
  WHERE t2.userId = overtime_transactions.userId
    AND t2.date < overtime_transactions.date
);
```

---

## Phase 5: Type Safety Improvements (Development Only)

### Replace 'any' Types
```bash
# Find all 'any' usage
grep -r ": any" server/src/ --include="*.ts"

# Replace with proper types
# Example: reportService.ts
- function calculateDailyBreakdown(userId: number, user: any, ...)
+ function calculateDailyBreakdown(userId: number, user: UserPublic, ...)
```

### Final Development Commit
```bash
git add .
git commit -m "refactor: Improve type safety - remove all 'any' types"
git push origin fix/system-inconsistencies
```

---

## 🧪 Complete Testing Phase (Week 8-9)

### CRITICAL: All fixes must be FULLY tested before production!

### 1. Unit Test Coverage
```bash
# Ensure 100% test coverage for all new code
npm test -- --coverage

# Specifically test:
npm test -- unifiedOvertimeService
npm test -- overtimeTransactionManager
npm test -- timezone
```

### 2. Integration Testing
```bash
# Test complete overtime calculation flow
npm run test:integration:overtime

# Test with production-like data
npm run test:with-prod-data
```

### 3. Regression Testing
```bash
# Compare ALL users before/after fixes
npm run validate:overtime:detailed -- --all > final_test_results.txt

# Ensure no unexpected changes
diff baseline_development.txt final_test_results.txt
```

### 4. Performance Testing
```bash
# Measure API response times
npm run test:performance

# Ensure no performance degradation
# Target: <200ms for all endpoints
```

### 5. User Acceptance Testing Scenarios
- [ ] Create time entry → Verify overtime calculation
- [ ] Add absence request → Verify transaction creation
- [ ] Manual correction → Verify no duplicates
- [ ] Month transition → Verify carryover
- [ ] Report generation → Verify consistency

---

## 🚀 FINAL PRODUCTION DEPLOYMENT (Week 10)

### ⚠️ ONLY AFTER ALL PHASES COMPLETE AND TESTED!

### Pre-Deployment Checklist
```bash
# 1. Verify feature branch is complete
git log --oneline origin/fix/system-inconsistencies

# 2. All tests passing
npm test

# 3. TypeScript compiles
npx tsc --noEmit

# 4. No console.logs in production code
grep -r "console.log" server/src/ --include="*.ts"

# 5. Documentation updated
# - CHANGELOG.md updated with all changes
# - ARCHITECTURE.md reflects new architecture
# - API documentation current
```

### Production Backup
```bash
# CRITICAL: Full backup before deployment!
ssh ubuntu@129.159.8.19

# Create timestamped backup
cd /home/ubuntu/TimeTracking-Clean/server
sqlite3 database.db ".backup database_pre_v1.6.0_$(date +%Y%m%d_%H%M%S).db"

# Verify backup
ls -la database_pre_v1.6.0_*.db

# Download backup locally
exit
scp ubuntu@129.159.8.19:/home/ubuntu/TimeTracking-Clean/server/database_pre_v1.6.0_*.db ./backups/
```

### Merge to Main
```bash
# 1. Final review of all changes
git diff main...fix/system-inconsistencies

# 2. Create Pull Request
gh pr create --title "fix: System inconsistencies - Timezone, Unified Service, Transaction Dedup" \
  --body "Fixes 15 critical inconsistencies. See SYSTEM_INCONSISTENCIES_REPORT.md"

# 3. Code review by team

# 4. Merge PR (after approval)
git checkout main
git pull origin main
git merge --no-ff fix/system-inconsistencies
git push origin main
```

### Production Deployment
```bash
# Automatic deployment via GitHub Actions
# Monitor deployment:
gh run watch

# Manual deployment if needed:
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Clean
git pull origin main
cd server
npm install
npm run build
pm2 restart timetracking-server
```

### Post-Deployment Validation
```bash
# 1. Health check
curl http://129.159.8.19:3000/api/health

# 2. Monitor logs for errors
ssh ubuntu@129.159.8.19
pm2 logs timetracking-server --lines 200 | grep -i error

# 3. Test critical endpoints
curl http://129.159.8.19:3000/api/reports/overtime/user/1

# 4. Check for timezone issues
sqlite3 database.db "SELECT COUNT(*) FROM time_entries WHERE date LIKE '%-00' OR date LIKE '%-32'"

# 5. Check for duplicate transactions
sqlite3 database.db "SELECT userId, date, type, COUNT(*) as cnt FROM overtime_transactions GROUP BY userId, date, type HAVING cnt > 1"
```

### Emergency Rollback Plan
```bash
# IF CRITICAL ISSUES DETECTED:

# 1. Immediate rollback
ssh ubuntu@129.159.8.19
cd /home/ubuntu/TimeTracking-Clean
git log --oneline -5  # Find previous commit
git reset --hard <previous-commit-hash>
pm2 restart timetracking-server

# 2. Restore database if needed
sqlite3 database.db ".restore database_pre_v1.6.0_[timestamp].db"
pm2 restart timetracking-server

# 3. Notify team and users
```

---

## 📊 Development Validation & Monitoring

### Daily Validation Queries
```sql
-- Check for calculation discrepancies
SELECT u.username, ob.month,
       ob.overtime as stored,
       (ob.actualHours - ob.targetHours) as calculated,
       ABS(ob.overtime - (ob.actualHours - ob.targetHours)) as diff
FROM overtime_balance ob
JOIN users u ON u.id = ob.userId
WHERE ABS(diff) > 0.01;

-- Check for duplicate transactions
SELECT userId, date, type, COUNT(*) as cnt
FROM overtime_transactions
GROUP BY userId, date, type, referenceId
HAVING COUNT(*) > 1;

-- Check timezone issues
SELECT COUNT(*) as wrong_dates
FROM time_entries
WHERE date LIKE '%-00' OR date LIKE '%-32';
```

### Performance Monitoring
```bash
# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/reports/overtime/user/1

# Check database query performance
sqlite3 database.db "EXPLAIN QUERY PLAN SELECT ..."
```

---

## 🔄 Rollback Strategies

### Feature Flags
```javascript
// Quick disable without deployment
featureFlags.useUnifiedOvertimeService = false;
featureFlags.useTransactionManager = false;
```

### Database Rollback
```bash
# Before each phase
sqlite3 database.db ".backup database_backup_$(date +%Y%m%d).db"

# Rollback if needed
cp database_backup_20260205.db database.db
pm2 restart timetracking-server
```

### Git Rollback
```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific version
git reset --hard <commit-hash>
git push --force origin main  # Use with caution!
```

---

## ✅ Development Success Criteria

### Before Production Deployment, verify:

### Phase 1 (Timezone) ✅ COMPLETED (2026-02-05)
- [x] All 17 files updated in feature branch
- [x] Zero `toISOString().split('T')[0]` occurrences
- [x] All tests passing in development
- [x] No date shift issues in test data
- **Commit:** `d02f405` - "fix: Phase 1 - Replace all timezone-unsafe date operations with formatDate()"

### Phase 2 (Unified Service) ✅ COMPLETED (2026-02-05)
- [x] UnifiedOvertimeService fully implemented
- [x] All services delegating to unified service
- [x] Zero calculation discrepancies in dev tests
- [x] Performance unchanged or improved
- **Commits:**
  - `938518e` - "feat: Implement UnifiedOvertimeService as Single Source of Truth"
  - 8 unit tests passing (unifiedOvertimeService.test.ts)

### Phase 3 (Transactions) ✅ COMPLETED (2026-02-05)
- [x] OvertimeTransactionManager implemented (overtimeTransactionService.ts)
- [x] Zero duplicate transactions in test runs
- [x] All transaction creation centralized
- [x] Audit trail complete in dev database
- **Commit:** `a2c1d25` - "feat: Centralize overtime transaction creation (Phase 3)"
- **Tests:** 4 centralization tests passing (overtimeTransactionCentralization.test.ts)

### Phase 4 (Database) ✅ COMPLETED (2026-02-06)
- [x] Balance tracking columns added (balanceBefore, balanceAfter)
- [x] Historical data backfilled successfully (186 transactions: 40 updated, 146 skipped)
- [x] Queries optimized and tested
- [x] No data loss in migration tests
- **Commit:** `e7c2342` - "feat: Phase 4 - Add balance tracking to overtime transactions"
- **Tests:** 7 balance tracking tests passing (balanceTracking.test.ts)
- **Script:** backfillOvertimeBalances.ts (100% success rate)

### Phase 5 (Type Safety) 🔶 IN PROGRESS
- [ ] Zero 'any' types in codebase (40 TypeScript errors remaining)
- [ ] All types properly defined
- [ ] TypeScript strict mode enabled
- [ ] No runtime type errors in tests
- **Status:** Starting implementation (2026-02-06)

### Final Release Criteria ✓
- [ ] All 5 phases complete
- [ ] 100% test coverage for new code
- [ ] Performance benchmarks met
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Rollback plan tested

---

## 📞 Support & Escalation

### During Migration
- **Primary Contact:** Development Team Lead
- **Backup Contact:** DevOps Team
- **Emergency Rollback:** Follow rollback strategies above

### Issues to Watch For
1. **Timezone shifts** - Dates appearing one day off
2. **Calculation mismatches** - Different overtime values
3. **Duplicate transactions** - Same transaction appearing multiple times
4. **Performance degradation** - Slower API responses
5. **Type errors** - Runtime crashes due to type mismatches

### Monitoring Commands
```bash
# Check server logs
pm2 logs timetracking-server --lines 100

# Check error rate
pm2 describe timetracking-server | grep restart

# Database integrity
sqlite3 database.db "PRAGMA integrity_check;"

# API health
curl http://129.159.8.19:3000/api/health
```

---

**Document Status:** READY FOR REVIEW
**Next Steps:** Team review and approval before Phase 1 start
**Questions:** Contact Development Team