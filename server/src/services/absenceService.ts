import { db } from '../database/connection.js';
import type { AbsenceRequest } from '../types/index.js';

/**
 * Absence Service
 * Business Logic for Absence Management (Vacation, Sick Leave, etc.)
 */

interface AbsenceRequestCreateInput {
  userId: number;
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp';
  startDate: string;
  endDate: string;
  reason?: string;
}

interface AbsenceRequestUpdateInput {
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
}

interface VacationBalance {
  id: number;
  userId: number;
  year: number;
  entitlement: number;
  carryover: number;
  taken: number;
  remaining: number;
}

/**
 * Calculate number of business days between two dates (excluding weekends)
 */
export function calculateBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Check if date is a holiday
 */
export function isHoliday(date: string): boolean {
  const query = 'SELECT id FROM holidays WHERE date = ?';
  const result = db.prepare(query).get(date);
  return !!result;
}

/**
 * Calculate vacation days (business days - holidays)
 */
export function calculateVacationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    // Only count weekdays that are not holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(dateStr)) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Validate absence request dates
 */
export function validateAbsenceDates(data: {
  startDate: string;
  endDate: string;
}): { valid: boolean; error?: string } {
  // Date format validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.startDate)) {
    return { valid: false, error: 'Invalid start date format (use YYYY-MM-DD)' };
  }
  if (!dateRegex.test(data.endDate)) {
    return { valid: false, error: 'Invalid end date format (use YYYY-MM-DD)' };
  }

  // Parse dates
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  // Check start date is not before end date
  if (startDate > endDate) {
    return { valid: false, error: 'End date must be after start date' };
  }

  return { valid: true };
}

/**
 * Check if user has enough vacation days
 */
export function hasEnoughVacationDays(
  userId: number,
  year: number,
  requestedDays: number
): boolean {
  const balance = getVacationBalance(userId, year);
  if (!balance) {
    return false;
  }
  return balance.remaining >= requestedDays;
}

/**
 * Get all absence requests (with optional filters)
 */
export function getAllAbsenceRequests(filters?: {
  userId?: number;
  status?: string;
  type?: string;
}): AbsenceRequest[] {
  let query = 'SELECT * FROM absence_requests WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.userId) {
    query += ' AND userId = ?';
    params.push(filters.userId);
  }

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }

  query += ' ORDER BY createdAt DESC';

  return db.prepare(query).all(...params) as AbsenceRequest[];
}

/**
 * Get absence request by ID
 */
export function getAbsenceRequestById(id: number): AbsenceRequest | null {
  const query = 'SELECT * FROM absence_requests WHERE id = ?';
  const request = db.prepare(query).get(id) as AbsenceRequest | undefined;
  return request || null;
}

/**
 * Create new absence request
 */
export function createAbsenceRequest(
  data: AbsenceRequestCreateInput
): AbsenceRequest {
  // Validate dates
  const validation = validateAbsenceDates(data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Calculate days
  let days: number;
  if (data.type === 'vacation' || data.type === 'overtime_comp') {
    // Exclude weekends and holidays
    days = calculateVacationDays(data.startDate, data.endDate);
  } else {
    // Sick leave and unpaid: count business days only (exclude weekends)
    days = calculateBusinessDays(data.startDate, data.endDate);
  }

  if (days <= 0) {
    throw new Error('Absence request must span at least one business day');
  }

  // For vacation: check if user has enough days
  if (data.type === 'vacation') {
    const year = parseInt(data.startDate.substring(0, 4));
    if (!hasEnoughVacationDays(data.userId, year, days)) {
      throw new Error('Insufficient vacation days remaining');
    }
  }

  // For overtime compensation: check if user has enough overtime
  if (data.type === 'overtime_comp') {
    const overtimeHours = getTotalOvertimeHours(data.userId);
    const requiredHours = days * 8; // Assume 8h per day

    if (overtimeHours < requiredHours) {
      throw new Error(
        `Insufficient overtime hours (need ${requiredHours}h, have ${overtimeHours}h)`
      );
    }
  }

  // Set initial status: sick leave is auto-approved, others are pending
  const status = data.type === 'sick' ? 'approved' : 'pending';

  // Insert request
  const query = `
    INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const result = db
    .prepare(query)
    .run(
      data.userId,
      data.type,
      data.startDate,
      data.endDate,
      days,
      status,
      data.reason || null
    );

  // If auto-approved (sick), update balances immediately
  if (status === 'approved') {
    updateBalancesAfterApproval(result.lastInsertRowid as number);
  }

  // Return created request
  const request = getAbsenceRequestById(result.lastInsertRowid as number);
  if (!request) {
    throw new Error('Failed to create absence request');
  }

  return request;
}

/**
 * Update absence request
 */
export function updateAbsenceRequest(
  id: number,
  data: AbsenceRequestUpdateInput
): AbsenceRequest {
  const existing = getAbsenceRequestById(id);
  if (!existing) {
    throw new Error('Absence request not found');
  }

  // Cannot modify approved/rejected requests (except admin note)
  if (
    existing.status !== 'pending' &&
    (data.startDate || data.endDate || data.reason)
  ) {
    throw new Error('Cannot modify approved or rejected absence request');
  }

  // If dates changed, recalculate days
  let days = existing.days;
  if (data.startDate || data.endDate) {
    const startDate = data.startDate || existing.startDate;
    const endDate = data.endDate || existing.endDate;

    // Validate new dates
    const validation = validateAbsenceDates({ startDate, endDate });
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Recalculate days
    if (existing.type === 'vacation' || existing.type === 'overtime_comp') {
      days = calculateVacationDays(startDate, endDate);
    } else {
      days = calculateBusinessDays(startDate, endDate);
    }
  }

  // Build update query
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.startDate !== undefined) {
    fields.push('startDate = ?');
    values.push(data.startDate);
  }
  if (data.endDate !== undefined) {
    fields.push('endDate = ?');
    values.push(data.endDate);
  }
  if (data.reason !== undefined) {
    fields.push('reason = ?');
    values.push(data.reason || null);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }
  if (data.adminNote !== undefined) {
    fields.push('adminNote = ?');
    values.push(data.adminNote || null);
  }
  if (days !== existing.days) {
    fields.push('days = ?');
    values.push(days);
  }

  values.push(id);

  const query = `
    UPDATE absence_requests
    SET ${fields.join(', ')}
    WHERE id = ?
  `;

  db.prepare(query).run(...values);

  // Return updated request
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Failed to update absence request');
  }

  return request;
}

/**
 * Approve absence request
 */
export function approveAbsenceRequest(
  id: number,
  approvedBy: number,
  adminNote?: string
): AbsenceRequest {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Only pending requests can be approved');
  }

  // Update request status
  const query = `
    UPDATE absence_requests
    SET status = 'approved', approvedBy = ?, approvedAt = datetime('now'), adminNote = ?
    WHERE id = ?
  `;

  db.prepare(query).run(approvedBy, adminNote || null, id);

  // Update balances
  updateBalancesAfterApproval(id);

  // Return updated request
  const updated = getAbsenceRequestById(id);
  if (!updated) {
    throw new Error('Failed to approve absence request');
  }

  return updated;
}

/**
 * Reject absence request
 */
export function rejectAbsenceRequest(
  id: number,
  approvedBy: number,
  adminNote?: string
): AbsenceRequest {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Only pending requests can be rejected');
  }

  // Update request status
  const query = `
    UPDATE absence_requests
    SET status = 'rejected', approvedBy = ?, approvedAt = datetime('now'), adminNote = ?
    WHERE id = ?
  `;

  db.prepare(query).run(approvedBy, adminNote || null, id);

  // Return updated request
  const updated = getAbsenceRequestById(id);
  if (!updated) {
    throw new Error('Failed to reject absence request');
  }

  return updated;
}

/**
 * Delete absence request
 */
export function deleteAbsenceRequest(id: number): void {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  // If approved, need to revert balance changes
  if (request.status === 'approved') {
    revertBalancesAfterDeletion(id);
  }

  const query = 'DELETE FROM absence_requests WHERE id = ?';
  db.prepare(query).run(id);
}

/**
 * Update balances after approval (vacation balance, overtime)
 */
function updateBalancesAfterApproval(requestId: number): void {
  const request = getAbsenceRequestById(requestId);
  if (!request) {
    throw new Error('Absence request not found');
  }

  const year = parseInt(request.startDate.substring(0, 4));

  if (request.type === 'vacation') {
    // Deduct from vacation balance
    updateVacationTaken(request.userId, year, request.days);
  } else if (request.type === 'overtime_comp') {
    // Deduct from overtime balance
    const hoursToDeduct = request.days * 8; // 8 hours per day
    deductOvertimeHours(request.userId, hoursToDeduct);
  }
}

/**
 * Revert balance changes after deletion
 */
function revertBalancesAfterDeletion(requestId: number): void {
  const request = getAbsenceRequestById(requestId);
  if (!request) return;

  const year = parseInt(request.startDate.substring(0, 4));

  if (request.type === 'vacation') {
    // Add back to vacation balance
    updateVacationTaken(request.userId, year, -request.days);
  } else if (request.type === 'overtime_comp') {
    // Add back to overtime balance
    const hoursToAdd = request.days * 8;
    deductOvertimeHours(request.userId, -hoursToAdd);
  }
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
 * Initialize vacation balance for a user and year
 */
export function initializeVacationBalance(
  userId: number,
  year: number
): VacationBalance {
  // Get user's vacation entitlement
  const user = db
    .prepare('SELECT vacationDaysPerYear FROM users WHERE id = ?')
    .get(userId) as { vacationDaysPerYear: number } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  // Check if previous year balance exists for carryover
  const previousYear = year - 1;
  const previousBalance = getVacationBalance(userId, previousYear);
  const carryover =
    previousBalance && previousBalance.remaining > 0
      ? Math.min(previousBalance.remaining, 5) // Max 5 days carryover
      : 0;

  // Insert or update balance
  const query = `
    INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(userId, year)
    DO UPDATE SET entitlement = ?, carryover = ?
  `;

  db.prepare(query).run(
    userId,
    year,
    user.vacationDaysPerYear,
    carryover,
    user.vacationDaysPerYear,
    carryover
  );

  const balance = getVacationBalance(userId, year);
  if (!balance) {
    throw new Error('Failed to initialize vacation balance');
  }

  return balance;
}

/**
 * Update vacation taken days
 */
function updateVacationTaken(userId: number, year: number, days: number): void {
  // Ensure balance exists
  let balance = getVacationBalance(userId, year);
  if (!balance) {
    balance = initializeVacationBalance(userId, year);
  }

  const query = `
    UPDATE vacation_balance
    SET taken = taken + ?
    WHERE userId = ? AND year = ?
  `;

  db.prepare(query).run(days, userId, year);
}

/**
 * Get total overtime hours for a user
 */
function getTotalOvertimeHours(userId: number): number {
  const query = `
    SELECT COALESCE(SUM(overtime), 0) as total
    FROM overtime_balance
    WHERE userId = ?
  `;

  const result = db.prepare(query).get(userId) as { total: number };
  return result.total;
}

/**
 * Deduct overtime hours
 */
function deductOvertimeHours(userId: number, hours: number): void {
  // Get all overtime balances for user, ordered by month
  const query = `
    SELECT * FROM overtime_balance
    WHERE userId = ? AND overtime > 0
    ORDER BY month ASC
  `;

  const balances = db.prepare(query).all(userId) as Array<{
    id: number;
    month: string;
    overtime: number;
  }>;

  let remainingHours = hours;

  // Deduct from oldest months first (FIFO)
  for (const balance of balances) {
    if (remainingHours <= 0) break;

    const toDeduct = Math.min(remainingHours, balance.overtime);
    const newActualHours = balance.overtime - toDeduct; // This will be recalculated by updateOvertimeBalance

    // We need to reduce actualHours in the overtime_balance table
    // Since overtime is a VIRTUAL column (actualHours - targetHours),
    // we need to update actualHours
    const updateQuery = `
      UPDATE overtime_balance
      SET actualHours = actualHours - ?
      WHERE id = ?
    `;

    db.prepare(updateQuery).run(toDeduct, balance.id);

    remainingHours -= toDeduct;
  }
}
