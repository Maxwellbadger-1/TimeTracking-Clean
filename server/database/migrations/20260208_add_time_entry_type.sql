-- Migration: Add 'time_entry' type to overtime_transactions CHECK constraint
-- Date: 2026-02-08
-- Reason: Code uses 'time_entry' type but DB constraint doesn't allow it, causing 500 errors

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE overtime_transactions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  date DATE NOT NULL,
  hours REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN (
    'worked',
    'time_entry',  -- NEW TYPE ADDED
    'vacation_credit',
    'sick_credit',
    'overtime_comp_credit',
    'special_credit',
    'unpaid_deduction',
    'holiday_credit',
    'weekend_credit',
    'carry_over',
    'payout',
    'correction',
    'initial_balance',
    'year_end_balance'
  )),
  description TEXT,
  referenceType TEXT,
  referenceId INTEGER,
  balanceBefore REAL,
  balanceAfter REAL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdBy INTEGER,
  FOREIGN KEY (userId) REFERENCES users (id),
  FOREIGN KEY (createdBy) REFERENCES users (id)
);

-- Step 2: Copy all data from old table
INSERT INTO overtime_transactions_new
SELECT * FROM overtime_transactions;

-- Step 3: Drop old table
DROP TABLE overtime_transactions;

-- Step 4: Rename new table to original name
ALTER TABLE overtime_transactions_new RENAME TO overtime_transactions;

-- Step 5: Recreate indexes if any existed (add if needed)
-- CREATE INDEX IF NOT EXISTS idx_overtime_transactions_userId ON overtime_transactions(userId);
-- CREATE INDEX IF NOT EXISTS idx_overtime_transactions_date ON overtime_transactions(date);
