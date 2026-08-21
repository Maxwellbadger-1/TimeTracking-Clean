// Work Schedule Types (Flexible Arbeitszeitmodelle)
export interface WorkSchedule {
  monday: number;    // Hours for Monday (0-24)
  tuesday: number;   // Hours for Tuesday (0-24)
  wednesday: number; // Hours for Wednesday (0-24)
  thursday: number;  // Hours for Thursday (0-24)
  friday: number;    // Hours for Friday (0-24)
  saturday: number;  // Hours for Saturday (0-24)
  sunday: number;    // Hours for Sunday (0-24)
}

export type DayName = keyof WorkSchedule;

// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department: string | null;
  position: string | null;
  weeklyHours: number;
  workSchedule: WorkSchedule | null; // NULL = use weeklyHours/5 fallback
  vacationDaysPerYear: number;
  hireDate: string;
  endDate: string | null;
  status: 'active' | 'inactive';
  privacyConsentAt: string | null;
  forcePasswordChange: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface UserCreateInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department?: string;
  position?: string;
  weeklyHours?: number;
  workSchedule?: WorkSchedule | null; // Optional: Individual work schedule
  vacationDaysPerYear?: number;
  hireDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional)
  isActive?: boolean; // Maps to status field ('active' | 'inactive')
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department: string | null;
  position: string | null;
  weeklyHours: number;
  workSchedule: WorkSchedule | null; // NULL = use weeklyHours/5 fallback
  vacationDaysPerYear: number;
  hireDate: string;
  endDate: string | null;
  status: 'active' | 'inactive';
  privacyConsentAt: string | null;
  createdAt: string;
  deletedAt?: string | null;
  isActive?: boolean;
}

// Session Types
export interface SessionUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  weeklyHours: number;
  workSchedule?: WorkSchedule | null; // Individual work schedule (NULL = use weeklyHours/5 fallback)
  vacationDaysPerYear: number;
  hireDate: string;
  privacyConsentAt?: string | null; // GDPR: Privacy policy acceptance timestamp
}

// Declare session data for express-session
declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  token?: string; // JWT token (optional, returned on login)
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore: boolean;
    cursor?: number | null; // For cursor-based pagination
  };
}

// Time Entry Types
export interface TimeEntry {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  activity: string | null;
  project: string | null;
  location: 'office' | 'homeoffice' | 'field';
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// Absence Request Types
export interface AbsenceRequest {
  id: number;
  userId: number;
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp';
  startDate: string;
  endDate: string;
  days: number;
  calculatedHours?: number;  // Real hours based on workSchedule/weeklyHours (calculated on-demand)
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  adminNote: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
}

// Department Types
export interface Department {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

// Project Types
export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}

// GDPR Data Export Types (DSGVO Art. 15)
export interface GDPRDataExport {
  exportDate: string;
  user: UserPublic;
  timeEntries: TimeEntry[];
  absenceRequests: AbsenceRequest[];
  overtimeBalance: {
    totalHours: number;
    lastUpdated: string;
  };
  vacationBalance: {
    availableDays: number;
    usedDays: number;
    totalDays: number;
    lastUpdated: string;
  };
}

// Overtime Correction Types
export interface OvertimeCorrection {
  id: number;
  userId: number;
  hours: number;
  date: string;
  reason: string;
  correctionType: 'system_error' | 'absence_credit' | 'migration' | 'manual';
  createdBy: number;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface OvertimeCorrectionCreateInput {
  userId: number;
  hours: number;
  date: string;
  reason: string;
  correctionType: 'system_error' | 'absence_credit' | 'migration' | 'manual';
}

export interface OvertimeCorrectionWithUser extends OvertimeCorrection {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  creator: {
    firstName: string;
    lastName: string;
    email: string;
  };
  approver?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Work Time Account Types
export interface WorkTimeAccount {
  id: number;
  userId: number;
  currentBalance: number;
  maxPlusHours: number;
  maxMinusHours: number;
  lastUpdated: string;
}

export interface WorkTimeAccountWithUser extends WorkTimeAccount {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    weeklyHours: number;
  };
}

export interface WorkTimeAccountUpdateInput {
  maxPlusHours?: number;
  maxMinusHours?: number;
}

// Arbeitszeit-Perioden (user_work_periods) — Milestone v3.0, Phase 10 (REQ-20/22)
//
// Historisiert weeklyHours/workSchedule statt sie flach in users zu halten. Eine
// Umstellung verschiebt keine Vergangenheit: was bis zum Stichtag gerechnet wurde,
// bleibt stehen, ab dem Stichtag gilt das neue Modell.
export interface UserWorkPeriod {
  id: number;
  userId: number;
  /** Inklusiv: Erster Geltungstag dieser Periode (YYYY-MM-DD, D1). */
  validFrom: string;
  /** Exklusiv: Erster Tag, an dem diese Periode NICHT mehr gilt. NULL = laufende Periode (D1). */
  validTo: string | null;
  /** Gemeinsam mit workSchedule versioniert — eine Kombination aus altem weeklyHours und
   *  neuem workSchedule darf nicht entstehen (D2). */
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
  note: string | null;
  createdAt: string;
  createdBy: number | null;
}

/** Rohe Datenbankzeile — workSchedule kommt als JSON-TEXT aus SQLite. Die Umwandlung nach
 *  WorkSchedule | null passiert im Service (Plan 10-04), nicht hier mit `any`. */
export interface UserWorkPeriodRow {
  id: number;
  userId: number;
  validFrom: string;
  validTo: string | null;
  weeklyHours: number;
  workSchedule: string | null;
  note: string | null;
  createdAt: string;
  createdBy: number | null;
}
