// Shared types for Desktop App

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

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department: string | null;
  position?: string | null;
  weeklyHours: number;
  workSchedule?: WorkSchedule | null; // NULL = use weeklyHours/5 fallback
  vacationDaysPerYear: number;
  hireDate: string; // Eintrittsdatum (YYYY-MM-DD)
  endDate?: string | null; // Austrittsdatum (optional)
  isActive: boolean;
  status?: 'active' | 'inactive';
  privacyConsentAt?: string | null; // DSGVO Privacy Consent Timestamp
  createdAt: string;
  deletedAt?: string | null;
}

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
  description?: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt?: string | null; // Soft delete timestamp
  // User information (from JOIN)
  firstName?: string;
  lastName?: string;
  email?: string;
  userInitials?: string; // e.g. "MM" for Max Mustermann
}

export interface AbsenceRequest {
  id: number;
  userId: number;
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp';
  startDate: string;
  endDate: string;
  days: number; // Database field name
  calculatedHours?: number; // Real hours based on workSchedule/weeklyHours (calculated on-demand by backend)
  daysRequired?: number; // Legacy alias (for backwards compatibility)
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  adminNote: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  rejectedBy?: number | null; // Who rejected the request
  createdAt: string;
  updatedAt?: string; // When the request was last updated
  // User information (from JOIN)
  firstName?: string;
  lastName?: string;
  email?: string;
  userInitials?: string; // e.g. "MM" for Max Mustermann
}

export interface VacationBalance {
  id: number;
  userId: number;
  year: number;
  entitlement: number;
  carryover: number;
  taken: number;
  pending: number;
  remaining: number;
  createdAt?: string; // Creation timestamp
}

export interface OvertimeBalance {
  targetHours: number;
  actualHours: number;
  overtime: number;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// DSGVO/GDPR Data Export (Art. 15 - Right to Data Portability)
export interface GDPRDataExport {
  exportDate: string;
  user: User;
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
