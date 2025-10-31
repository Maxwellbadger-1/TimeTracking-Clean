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
  if (data.password.length < 6) {
    res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters',
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
    if (data.password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
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
