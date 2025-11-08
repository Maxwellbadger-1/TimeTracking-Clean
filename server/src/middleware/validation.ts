import type { Request, Response, NextFunction } from 'express';
import type { UserCreateInput } from '../types/index.js';

/**
 * Validation Middleware
 */

/**
 * Validate user creation data
 */
export function validateUserCreate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const data = req.body as Partial<UserCreateInput>;

  // Required fields
  if (!data.username?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Username is required',
    });
    return;
  }

  if (!data.email?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Email is required',
    });
    return;
  }

  if (!data.password) {
    res.status(400).json({
      success: false,
      error: 'Password is required',
    });
    return;
  }

  if (!data.firstName?.trim()) {
    res.status(400).json({
      success: false,
      error: 'First name is required',
    });
    return;
  }

  if (!data.lastName?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Last name is required',
    });
    return;
  }

  if (!data.role || !['admin', 'employee'].includes(data.role)) {
    res.status(400).json({
      success: false,
      error: 'Role must be either "admin" or "employee"',
    });
    return;
  }

  // Username validation
  if (data.username.length < 3) {
    res.status(400).json({
      success: false,
      error: 'Username must be at least 3 characters',
    });
    return;
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(data.username)) {
    res.status(400).json({
      success: false,
      error: 'Username can only contain letters, numbers, dots, dashes and underscores',
    });
    return;
  }

  // Email validation
  if (!data.email.includes('@')) {
    res.status(400).json({
      success: false,
      error: 'Invalid email format',
    });
    return;
  }

  // Password validation
  if (data.password.length < 8) {
    res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters',
    });
    return;
  }

  // Weekly hours validation
  if (data.weeklyHours !== undefined) {
    if (data.weeklyHours < 0 || data.weeklyHours > 80) {
      res.status(400).json({
        success: false,
        error: 'Weekly hours must be between 0 and 80',
      });
      return;
    }
  }

  // Vacation days validation
  if (data.vacationDaysPerYear !== undefined) {
    if (data.vacationDaysPerYear < 0 || data.vacationDaysPerYear > 50) {
      res.status(400).json({
        success: false,
        error: 'Vacation days must be between 0 and 50',
      });
      return;
    }
  }

  next();
}

/**
 * Validate user update data
 */
export function validateUserUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const data = req.body as Partial<UserCreateInput>;

  // Username validation (if provided)
  if (data.username !== undefined) {
    if (!data.username.trim()) {
      res.status(400).json({
        success: false,
        error: 'Username cannot be empty',
      });
      return;
    }

    if (data.username.length < 3) {
      res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters',
      });
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(data.username)) {
      res.status(400).json({
        success: false,
        error: 'Username can only contain letters, numbers, dots, dashes and underscores',
      });
      return;
    }
  }

  // Email validation (if provided)
  if (data.email !== undefined) {
    if (!data.email.trim()) {
      res.status(400).json({
        success: false,
        error: 'Email cannot be empty',
      });
      return;
    }

    if (!data.email.includes('@')) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
      return;
    }
  }

  // Password validation (if provided)
  if (data.password !== undefined) {
    if (data.password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
      return;
    }
  }

  // Role validation (if provided)
  if (data.role !== undefined) {
    if (!['admin', 'employee'].includes(data.role)) {
      res.status(400).json({
        success: false,
        error: 'Role must be either "admin" or "employee"',
      });
      return;
    }
  }

  // Weekly hours validation (if provided)
  if (data.weeklyHours !== undefined) {
    if (data.weeklyHours < 0 || data.weeklyHours > 80) {
      res.status(400).json({
        success: false,
        error: 'Weekly hours must be between 0 and 80',
      });
      return;
    }
  }

  // Vacation days validation (if provided)
  if (data.vacationDaysPerYear !== undefined) {
    if (data.vacationDaysPerYear < 0 || data.vacationDaysPerYear > 50) {
      res.status(400).json({
        success: false,
        error: 'Vacation days must be between 0 and 50',
      });
      return;
    }
  }

  next();
}

/**
 * Validate time entry creation data
 */
export function validateTimeEntryCreate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const data = req.body;

  // Required fields
  if (!data.date?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Date is required',
    });
    return;
  }

  if (!data.startTime?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Start time is required',
    });
    return;
  }

  if (!data.endTime?.trim()) {
    res.status(400).json({
      success: false,
      error: 'End time is required',
    });
    return;
  }

  if (!data.location || !['office', 'homeoffice', 'field'].includes(data.location)) {
    res.status(400).json({
      success: false,
      error: 'Location must be "office", "homeoffice", or "field"',
    });
    return;
  }

  // Date format validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.date)) {
    res.status(400).json({
      success: false,
      error: 'Invalid date format (use YYYY-MM-DD)',
    });
    return;
  }

  // Time format validation (HH:MM)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(data.startTime)) {
    res.status(400).json({
      success: false,
      error: 'Invalid start time format (use HH:MM)',
    });
    return;
  }

  if (!timeRegex.test(data.endTime)) {
    res.status(400).json({
      success: false,
      error: 'Invalid end time format (use HH:MM)',
    });
    return;
  }

  // Break minutes validation
  if (data.breakMinutes !== undefined) {
    const breakMinutes = parseInt(data.breakMinutes);
    if (isNaN(breakMinutes) || breakMinutes < 0) {
      res.status(400).json({
        success: false,
        error: 'Break minutes must be a positive number',
      });
      return;
    }
  }

  next();
}

/**
 * Validate time entry update data
 */
export function validateTimeEntryUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const data = req.body;

  // Date format validation (if provided)
  if (data.date !== undefined) {
    if (!data.date.trim()) {
      res.status(400).json({
        success: false,
        error: 'Date cannot be empty',
      });
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format (use YYYY-MM-DD)',
      });
      return;
    }
  }

  // Time format validation (if provided)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

  if (data.startTime !== undefined) {
    if (!data.startTime.trim()) {
      res.status(400).json({
        success: false,
        error: 'Start time cannot be empty',
      });
      return;
    }

    if (!timeRegex.test(data.startTime)) {
      res.status(400).json({
        success: false,
        error: 'Invalid start time format (use HH:MM)',
      });
      return;
    }
  }

  if (data.endTime !== undefined) {
    if (!data.endTime.trim()) {
      res.status(400).json({
        success: false,
        error: 'End time cannot be empty',
      });
      return;
    }

    if (!timeRegex.test(data.endTime)) {
      res.status(400).json({
        success: false,
        error: 'Invalid end time format (use HH:MM)',
      });
      return;
    }
  }

  // Location validation (if provided)
  if (data.location !== undefined) {
    if (!['office', 'homeoffice', 'field'].includes(data.location)) {
      res.status(400).json({
        success: false,
        error: 'Location must be "office", "homeoffice", or "field"',
      });
      return;
    }
  }

  // Break minutes validation (if provided)
  if (data.breakMinutes !== undefined) {
    const breakMinutes = parseInt(data.breakMinutes);
    if (isNaN(breakMinutes) || breakMinutes < 0) {
      res.status(400).json({
        success: false,
        error: 'Break minutes must be a positive number',
      });
      return;
    }
  }

  next();
}

/**
 * Validate absence request creation data
 */
export function validateAbsenceCreate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const data = req.body;

  // Required fields
  if (!data.type || !['vacation', 'sick', 'unpaid', 'overtime_comp'].includes(data.type)) {
    res.status(400).json({
      success: false,
      error: 'Type must be "vacation", "sick", "unpaid", or "overtime_comp"',
    });
    return;
  }

  if (!data.startDate?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Start date is required',
    });
    return;
  }

  if (!data.endDate?.trim()) {
    res.status(400).json({
      success: false,
      error: 'End date is required',
    });
    return;
  }

  // Date format validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.startDate)) {
    res.status(400).json({
      success: false,
      error: 'Invalid start date format (use YYYY-MM-DD)',
    });
    return;
  }

  if (!dateRegex.test(data.endDate)) {
    res.status(400).json({
      success: false,
      error: 'Invalid end date format (use YYYY-MM-DD)',
    });
    return;
  }

  next();
}

/**
 * Validate absence request update data
 */
export function validateAbsenceUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const data = req.body;

  // Date format validation (if provided)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (data.startDate !== undefined) {
    if (!data.startDate.trim()) {
      res.status(400).json({
        success: false,
        error: 'Start date cannot be empty',
      });
      return;
    }

    if (!dateRegex.test(data.startDate)) {
      res.status(400).json({
        success: false,
        error: 'Invalid start date format (use YYYY-MM-DD)',
      });
      return;
    }
  }

  if (data.endDate !== undefined) {
    if (!data.endDate.trim()) {
      res.status(400).json({
        success: false,
        error: 'End date cannot be empty',
      });
      return;
    }

    if (!dateRegex.test(data.endDate)) {
      res.status(400).json({
        success: false,
        error: 'Invalid end date format (use YYYY-MM-DD)',
      });
      return;
    }
  }

  // Status validation (if provided)
  if (data.status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(data.status)) {
      res.status(400).json({
        success: false,
        error: 'Status must be "pending", "approved", or "rejected"',
      });
      return;
    }
  }

  next();
}
