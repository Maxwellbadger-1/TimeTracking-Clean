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

  // Email validation (OPTIONAL - only validate if provided)
  if (data.email && !data.email.includes('@')) {
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

  // Email validation (if provided) - ALLOW empty strings (email is optional)
  if (data.email !== undefined && data.email !== null) {
    const trimmedEmail = data.email.trim();
    // Only validate format if email is NON-EMPTY
    if (trimmedEmail !== '' && !trimmedEmail.includes('@')) {
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

  // CR-02 (Code-Review Phase 11, Durchlauf 2): hireDate wurde hier bisher gar nicht
  // geprüft. `PUT /api/users/:id` mit `{"hireDate":"31.12.2026"}` oder `""` lief mit
  // HTTP 200 durch, schrieb den Müllwert in die Spalte und löschte dabei
  // `overtime_balance` — ohne dass die Salden je wieder aufgebaut werden konnten.
  // `userService.updateUser()` wirft seit CR-02 in diesem Fall; diese Prüfung übersetzt
  // denselben Sachverhalt in eine saubere 400er-Antwort, statt ihn als 500 zu servieren.
  if (data.hireDate !== undefined) {
    const hireDateError = describeHireDateProblem(data.hireDate);
    if (hireDateError) {
      res.status(400).json({
        success: false,
        error: hireDateError,
      });
      return;
    }
  }

  next();
}

/**
 * CR-02: Formprüfung für `hireDate`, deckungsgleich mit `assertWellFormedHireDate()` in
 * `userService.ts` und mit dem GLOB-CHECK von `user_work_periods.validFrom`
 * (Migration 008). Liefert `null`, wenn der Wert brauchbar ist, sonst die Meldung für die
 * 400er-Antwort.
 *
 * Bewusst hier dupliziert statt aus dem Service importiert: `userService.ts` zieht
 * `database/connection.js` und damit die Datenbankverbindung; die Validierungsschicht soll
 * ohne Datenbankzugriff ladbar bleiben. Die Regel selbst — vier Ziffern, Bindestrich, zwei
 * Ziffern, Bindestrich, zwei Ziffern, und ein echter Kalendertag — steht an beiden Stellen
 * ausformuliert und ist über die Kommentare aneinander gebunden.
 */
function describeHireDateProblem(hireDate: unknown): string | null {
  if (typeof hireDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
    return 'hireDate must be in format YYYY-MM-DD';
  }

  const [year, month, day] = hireDate.split('-').map(part => Number.parseInt(part, 10));
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDay =
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day;

  return isRealCalendarDay ? null : `hireDate is not a valid calendar date: ${hireDate}`;
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

  // Validate endTime > startTime
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (endMinutes <= startMinutes) {
    res.status(400).json({
      success: false,
      error: 'End time must be after start time',
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
