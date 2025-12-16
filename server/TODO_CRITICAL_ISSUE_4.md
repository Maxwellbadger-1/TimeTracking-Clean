# 🔴 CRITICAL ISSUE #4: Absence Credits Double-Counting Risk

**Severity**: CRITICAL
**Status**: ⚠️ REQUIRES SCHEMA MIGRATION - NOT YET FIXED
**Priority**: HIGH - Fix in next sprint

---

## Problem Description

Overtime corrections are added to actualHours WITHOUT checking if absence credits already exist for the same period. This could lead to double-counting if:

1. An absence is created (e.g., 3 days vacation = 24h credit)
2. Admin adds manual overtime correction for same period (e.g., +24h)
3. **Result**: Hours are counted TWICE (24h + 24h = 48h instead of 24h)

---

## Location

**File**: `/server/src/services/overtimeService.ts`
**Lines**: 398-401

```typescript
// Line 398: Get overtime corrections for this month
const overtimeCorrections = getTotalCorrectionsForUserInMonth(userId, month);

// Line 401: Add BOTH absence credits AND corrections
const actualHoursWithCredits = workedHours.total + absenceCredits + overtimeCorrections;
```

---

## Impact

- **Financial**: Employees get credited for hours twice, costing company money
- **Compliance**: Incorrect overtime reports violate German ArbZG (Arbeitszeitgesetz)
- **Trust**: Employees lose trust if corrections are applied inconsistently

---

## Solution Required

### Step 1: Schema Migration

Add metadata to `overtime_corrections` table to track correction source:

```sql
-- Migration: Add absenceId tracking to overtime_corrections
ALTER TABLE overtime_corrections
ADD COLUMN absenceId INTEGER REFERENCES absence_requests(id);

-- Also add reason/type to distinguish correction types
ALTER TABLE overtime_corrections
ADD COLUMN reason TEXT CHECK(reason IN ('manual', 'absence', 'system', 'other'));
```

### Step 2: Update Correction Logic

```typescript
// When creating absence, create linked correction
export function createAbsenceRequest(data: AbsenceCreateInput): AbsenceRequest {
  const absence = /* ... create absence ... */;

  if (absence.status === 'approved' &&
      ['vacation', 'sick', 'overtime_comp'].includes(absence.type)) {
    // Create linked correction to track this credit
    createOvertimeCorrection({
      userId: absence.userId,
      date: absence.startDate,
      hours: calculateAbsenceCreditHours(absence),
      reason: `Absence credit: ${absence.type}`,
      absenceId: absence.id, // ✅ Link to absence!
    });
  }

  return absence;
}
```

### Step 3: Update Overtime Calculation

```typescript
// Calculate actual hours for month
export function calculateMonthlyOvertime(userId: number, month: string): void {
  const workedHours = getTotalWorkedHoursForMonth(userId, month);

  // Get corrections that are NOT linked to absences (manual corrections only)
  const manualCorrections = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as total
    FROM overtime_corrections
    WHERE userId = ?
      AND date LIKE ?
      AND (absenceId IS NULL OR absenceId NOT IN (
        SELECT id FROM absence_requests WHERE status = 'approved'
      ))
  `).get(userId, `${month}%`);

  // Get absence credits (separate calculation)
  const absenceCredits = calculateAbsenceCreditsForMonth(userId, month);

  // Combine WITHOUT double-counting
  const actualHours = workedHours.total + absenceCredits + manualCorrections.total;

  // ...
}
```

---

## Migration Script Required

Create `/server/scripts/migrate-overtime-corrections.ts`:

```typescript
/**
 * Migration: Add absenceId column to overtime_corrections
 * Links corrections to their source absences to prevent double-counting
 */

import Database from 'better-sqlite3';
import { databaseConfig } from '../dist/config/database.js';

const db = new Database(databaseConfig.path);

console.log('🔧 Migration: Adding absenceId to overtime_corrections...\n');

try {
  // Step 1: Add columns
  db.exec(`
    ALTER TABLE overtime_corrections
    ADD COLUMN absenceId INTEGER REFERENCES absence_requests(id);
  `);

  db.exec(`
    ALTER TABLE overtime_corrections
    ADD COLUMN reason TEXT CHECK(reason IN ('manual', 'absence', 'system', 'other'));
  `);

  console.log('✅ Columns added successfully');

  // Step 2: Backfill existing corrections
  // Mark all existing corrections as 'manual' (assume they were admin-created)
  const updated = db.prepare(`
    UPDATE overtime_corrections
    SET reason = 'manual'
    WHERE reason IS NULL
  `).run();

  console.log(`✅ Backfilled ${updated.changes} existing corrections as 'manual'`);

  console.log('\n✅ Migration complete!');
  console.log('⚠️  IMPORTANT: Now run fix-overtime.ts to recalculate all overtime values');

} catch (error) {
  console.error('❌ Migration failed:', error);
  throw error;
} finally {
  db.close();
}
```

---

## Testing Plan

### Test Case 1: Absence + Manual Correction (Should NOT double-count)

```typescript
// 1. Create vacation (3 days = 24h credit)
createAbsenceRequest({
  userId: 1,
  type: 'vacation',
  startDate: '2025-12-20',
  endDate: '2025-12-22',
  days: 3,
});

// 2. Verify overtime includes 24h credit
const overtime1 = calculateMonthlyOvertime(1, '2025-12');
expect(overtime1.actualHours).toInclude(24); // ✅

// 3. Admin creates manual correction for different reason
createOvertimeCorrection({
  userId: 1,
  date: '2025-12-23',
  hours: 5,
  reason: 'Compensation for weekend work',
});

// 4. Verify BOTH credits are counted (24h + 5h = 29h)
const overtime2 = calculateMonthlyOvertime(1, '2025-12');
expect(overtime2.actualHours).toInclude(29); // ✅

// 5. Verify absence credit NOT double-counted
const corrections = getCorrectionsForMonth(1, '2025-12');
const absenceCorrections = corrections.filter(c => c.absenceId !== null);
expect(absenceCorrections).toHaveLength(1); // Only linked to absence
```

### Test Case 2: Multiple Absences (Should track all separately)

```typescript
// Multiple absences in same month
createAbsenceRequest({ type: 'sick', days: 2 }); // 16h
createAbsenceRequest({ type: 'vacation', days: 5 }); // 40h

const overtime = calculateMonthlyOvertime(userId, month);

// Should have 56h total absence credits (16h + 40h)
expect(overtime.actualHours - overtime.workedHours).toBe(56);

// Should have 2 linked corrections
const corrections = getCorrectionsForMonth(userId, month);
const linkedCorrections = corrections.filter(c => c.absenceId !== null);
expect(linkedCorrections).toHaveLength(2);
```

---

## Rollback Plan

If migration causes issues:

```sql
-- Remove columns (SQLite doesn't support DROP COLUMN easily)
-- Instead, create new table without the columns and copy data

BEGIN TRANSACTION;

-- Create backup
CREATE TABLE overtime_corrections_backup AS
SELECT * FROM overtime_corrections;

-- Create new table without new columns
CREATE TABLE overtime_corrections_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  createdBy INTEGER,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Copy old data
INSERT INTO overtime_corrections_new (id, userId, date, hours, description, createdAt, createdBy)
SELECT id, userId, date, hours, description, createdAt, createdBy
FROM overtime_corrections;

-- Swap tables
DROP TABLE overtime_corrections;
ALTER TABLE overtime_corrections_new RENAME TO overtime_corrections;

COMMIT;
```

---

## Timeline

- **Week 1**: Create migration script + update correction creation logic
- **Week 2**: Test on dev environment with sample data
- **Week 3**: Run migration on production during low-traffic window
- **Week 4**: Monitor for issues, rollback if needed

---

## Notes

- This issue was discovered during comprehensive code review (Dec 16, 2025)
- Currently NOT exploited in production (no manual corrections exist yet)
- MUST be fixed before admins start using manual corrections feature
- Consider adding admin UI warning when creating corrections for periods with absences

---

**Status**: 🟡 Documented, awaiting implementation
**Last Updated**: 2025-12-16
**Assigned To**: Development Team
