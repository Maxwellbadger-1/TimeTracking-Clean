import { db } from '../database/connection.js';

/**
 * Vacation Balance Service
 * Admin CRUD operations for managing employee vacation balances
 */

/**
 * Calculate pro-rata vacation days for mid-year hires
 * @param hireDate - User's hire date (ISO string)
 * @param vacationDaysPerYear - Annual vacation entitlement
 * @param year - Year to calculate for
 * @returns Pro-rata vacation days (rounded to 0.5 day precision)
 */
export function calculateProRataVacationDays(
  hireDate: string,
  vacationDaysPerYear: number,
  year: number
): number {
  const hire = new Date(hireDate);
  const hireYear = hire.getFullYear();

  // If hired before this year, give full entitlement
  if (hireYear < year) {
    return vacationDaysPerYear;
  }

  // If hired after this year, give 0
  if (hireYear > year) {
    return 0;
  }

  // Hired during this year - calculate pro-rata
  const endOfYear = new Date(year, 11, 31, 23, 59, 59); // Dec 31, end of day
  const daysInYear = 365;

  // Calculate days remaining (including hire date)
  const daysRemaining = Math.max(
    0,
    Math.ceil((endOfYear.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  // Pro-rata: (days remaining / days in year) * annual entitlement
  const proRata = (daysRemaining / daysInYear) * vacationDaysPerYear;

  // Round to 0.5 day precision (German standard)
  return Math.round(proRata * 2) / 2;
}

export interface VacationBalance {
  id: number;
  userId: number;
  year: number;
  entitlement: number;
  carryover: number;
  taken: number;
  remaining: number;
}

interface VacationBalanceCreateInput {
  userId: number;
  year: number;
  entitlement: number;
  carryover: number;
}

interface VacationBalanceUpdateInput {
  entitlement?: number;
  carryover?: number;
  taken?: number;
}

/**
 * Get all vacation balances (optionally filtered by userId or year)
 */
export function getAllVacationBalances(filters?: {
  userId?: number;
  year?: number;
}): VacationBalance[] {
  let query = `
    SELECT
      vb.*,
      u.firstName,
      u.lastName,
      u.email,
      u.vacationDaysPerYear
    FROM vacation_balance vb
    LEFT JOIN users u ON vb.userId = u.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.userId) {
    query += ' AND vb.userId = ?';
    params.push(filters.userId);
  }

  if (filters?.year) {
    query += ' AND vb.year = ?';
    params.push(filters.year);
  }

  query += ' ORDER BY vb.year DESC, u.lastName ASC, u.firstName ASC';

  const results = db.prepare(query).all(...params) as VacationBalance[];

  // Ensure numbers are properly typed (SQLite sometimes returns strings)
  return results.map(balance => ({
    ...balance,
    entitlement: Number(balance.entitlement) || 0,
    carryover: Number(balance.carryover) || 0,
    taken: Number(balance.taken) || 0,
    remaining: Number(balance.remaining) || 0,
  }));
}

/**
 * Get vacation balance by ID
 */
export function getVacationBalanceById(id: number): VacationBalance | null {
  const query = 'SELECT * FROM vacation_balance WHERE id = ?';
  const balance = db.prepare(query).get(id) as VacationBalance | undefined;
  return balance || null;
}

/**
 * Get vacation balance for a user and year
 */
export function getVacationBalance(
  userId: number,
  year: number
): VacationBalance | null {
  const query = `
    SELECT * FROM vacation_balance
    WHERE userId = ? AND year = ?
  `;

  const balance = db.prepare(query).get(userId, year) as
    | VacationBalance
    | undefined;

  return balance || null;
}

/**
 * Create or update vacation balance
 * ADMIN ONLY - Manual balance management
 */
export function upsertVacationBalance(
  data: VacationBalanceCreateInput
): VacationBalance {
  // Validation
  if (!data.userId || data.userId <= 0) {
    throw new Error('Valid userId is required');
  }

  if (!data.year || data.year < 2000 || data.year > 2100) {
    throw new Error('Valid year is required (2000-2100)');
  }

  if (data.entitlement < 0 || data.entitlement > 50) {
    throw new Error('Entitlement must be between 0 and 50 days');
  }

  if (data.carryover < 0 || data.carryover > 10) {
    throw new Error('Carryover must be between 0 and 10 days');
  }

  // Check if user exists
  const user = db
    .prepare('SELECT id FROM users WHERE id = ?')
    .get(data.userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Upsert balance
  const query = `
    INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(userId, year)
    DO UPDATE SET
      entitlement = excluded.entitlement,
      carryover = excluded.carryover
  `;

  db.prepare(query).run(
    data.userId,
    data.year,
    data.entitlement,
    data.carryover
  );

  const balance = getVacationBalance(data.userId, data.year);
  if (!balance) {
    throw new Error('Failed to create vacation balance');
  }

  return balance;
}

/**
 * Update vacation balance
 * ADMIN ONLY - Partial updates
 */
export function updateVacationBalance(
  id: number,
  data: VacationBalanceUpdateInput
): VacationBalance {
  // Get existing balance
  const existing = getVacationBalanceById(id);
  if (!existing) {
    throw new Error('Vacation balance not found');
  }

  // Validation
  if (data.entitlement !== undefined) {
    if (data.entitlement < 0 || data.entitlement > 50) {
      throw new Error('Entitlement must be between 0 and 50 days');
    }
  }

  if (data.carryover !== undefined) {
    if (data.carryover < 0 || data.carryover > 10) {
      throw new Error('Carryover must be between 0 and 10 days');
    }
  }

  if (data.taken !== undefined) {
    if (data.taken < 0 || data.taken > 100) {
      throw new Error('Taken must be between 0 and 100 days');
    }
  }

  // Build update query
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.entitlement !== undefined) {
    updates.push('entitlement = ?');
    params.push(data.entitlement);
  }

  if (data.carryover !== undefined) {
    updates.push('carryover = ?');
    params.push(data.carryover);
  }

  if (data.taken !== undefined) {
    updates.push('taken = ?');
    params.push(data.taken);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(id);

  const query = `
    UPDATE vacation_balance
    SET ${updates.join(', ')}
    WHERE id = ?
  `;

  db.prepare(query).run(...params);

  const updated = getVacationBalanceById(id);
  if (!updated) {
    throw new Error('Failed to update vacation balance');
  }

  return updated;
}

/**
 * Delete vacation balance
 * ADMIN ONLY - Use with caution!
 */
export function deleteVacationBalance(id: number): void {
  // Check if balance exists
  const existing = getVacationBalanceById(id);
  if (!existing) {
    throw new Error('Vacation balance not found');
  }

  // Check if balance has been used (taken > 0)
  if (existing.taken > 0) {
    throw new Error(
      'Cannot delete balance with taken days. Reset taken to 0 first.'
    );
  }

  const query = 'DELETE FROM vacation_balance WHERE id = ?';
  db.prepare(query).run(id);
}

/**
 * Bulk initialize vacation balances for all users for a given year
 * ADMIN ONLY - Useful for year-end rollover
 */
export function bulkInitializeVacationBalances(year: number): number {
  if (year < 2000 || year > 2100) {
    throw new Error('Valid year is required (2000-2100)');
  }

  // Get all active users
  const users = db
    .prepare(
      'SELECT id, vacationDaysPerYear FROM users WHERE deletedAt IS NULL'
    )
    .all() as Array<{ id: number; vacationDaysPerYear: number }>;

  if (users.length === 0) {
    return 0;
  }

  let count = 0;

  for (const user of users) {
    // Check if balance already exists
    const existing = getVacationBalance(user.id, year);
    if (existing) {
      continue; // Skip if already exists
    }

    // Get user's hire date for pro-rata calculation
    const userDetails = db
      .prepare('SELECT hireDate FROM users WHERE id = ?')
      .get(user.id) as { hireDate: string } | undefined;

    if (!userDetails?.hireDate) {
      continue; // Skip if no hire date
    }

    // Calculate pro-rata entitlement based on hire date
    const entitlement = calculateProRataVacationDays(
      userDetails.hireDate,
      user.vacationDaysPerYear,
      year
    );

    // Check previous year for carryover
    const previousYear = year - 1;
    const previousBalance = getVacationBalance(user.id, previousYear);
    const carryover =
      previousBalance && previousBalance.remaining > 0
        ? Math.min(previousBalance.remaining, 5) // Max 5 days carryover
        : 0;

    // Create balance
    const query = `
      INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
      VALUES (?, ?, ?, ?, 0)
    `;

    db.prepare(query).run(user.id, year, entitlement, carryover);
    count++;
  }

  return count;
}

/**
 * Get vacation balance summary for all users (current year)
 * Useful for admin dashboard overview
 */
export function getVacationBalanceSummary(year?: number): Array<{
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  entitlement: number;
  carryover: number;
  taken: number;
  remaining: number;
  hasBalance: boolean;
}> {
  const currentYear = year || new Date().getFullYear();

  const query = `
    SELECT
      u.id as userId,
      u.firstName,
      u.lastName,
      u.email,
      u.vacationDaysPerYear as defaultEntitlement,
      COALESCE(vb.entitlement, 0) as entitlement,
      COALESCE(vb.carryover, 0) as carryover,
      COALESCE(vb.taken, 0) as taken,
      COALESCE(vb.remaining, 0) as remaining,
      CASE WHEN vb.id IS NOT NULL THEN 1 ELSE 0 END as hasBalance
    FROM users u
    LEFT JOIN vacation_balance vb ON u.id = vb.userId AND vb.year = ?
    WHERE u.deletedAt IS NULL
    ORDER BY u.lastName ASC, u.firstName ASC
  `;

  return db.prepare(query).all(currentYear) as Array<{
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    entitlement: number;
    carryover: number;
    taken: number;
    remaining: number;
    hasBalance: boolean;
  }>;
}
