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

// Stundenwechsel-Vertrag (Milestone v3.0, Phase 12, REQ-26 bis REQ-29) — zeichengleiche
// Spiegelung von server/src/types/index.ts (Plan 12-01). D2: Vorschau und Speichern teilen
// sich WorkTimeChangePreview, damit im Client keine eigene Rechnung entsteht.

/** Spiegel von UserWorkPeriod (server/src/types/index.ts). */
export interface WorkTimePeriod {
  id: number;
  userId: number;
  /** Inklusiv: Erster Geltungstag dieser Periode (YYYY-MM-DD). */
  validFrom: string;
  /** Exklusiv: Erster Tag, an dem diese Periode NICHT mehr gilt. NULL = laufende Periode. */
  validTo: string | null;
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
  note: string | null;
  createdAt: string;
  createdBy: number | null;
}

export interface WorkTimeChangeInput {
  /** Nutzer, dessen Arbeitszeitmodell ab dem Stichtag geändert wird. */
  userId: number;
  /** Inklusiv: erster Geltungstag der neuen Periode (YYYY-MM-DD). Kann in der Vergangenheit
   *  oder Zukunft liegen (D3). */
  validFrom: string;
  /** Neue wöchentliche Sollstundenzahl der Periode ab validFrom. */
  weeklyHours: number;
  /** Neuer individueller Tagesplan, oder null für die pauschale Verteilung über weeklyHours. */
  workSchedule: WorkSchedule | null;
  /** Pflichtbegründung für die Journalbuchung (D5) — keine stille Änderung ohne Grund. */
  reason: string;
}

/** Ergebnis einer Vorschau- oder Speicher-Berechnung (D2: identischer Rückgabetyp für beide
 *  Pfade). Alle Stundenwerte sind bereits gerundet auf zwei Nachkommastellen. */
export interface WorkTimeChangePreview {
  userId: number;
  validFrom: string;
  /** true, wenn validFrom in der Vergangenheit liegt und deshalb ein Rebuild bis heute
   *  ausgelöst wird (D3). */
  isRetroactive: boolean;
  rangeStart: string;
  rangeEnd: string;
  workingDaysInRange: number;
  targetHoursBefore: number;
  targetHoursAfter: number;
  targetHoursDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  balanceDelta: number;
  /** Die bislang gültige Periode zum Stichtag, oder null, wenn keine existiert. */
  currentPeriod: { validFrom: string; weeklyHours: number; workSchedule: WorkSchedule | null } | null;
  /** true, wenn sich weder Sollstunden noch Tagesplan gegenüber der aktuell gültigen Periode
   *  ändern — die Oberfläche zeigt dann das Panel "nichts zu tun". */
  isNoOp: boolean;
  /** true, wenn der Stichtag nicht auf den Monatsersten fällt. */
  midMonthEffective: boolean;
  /** Von rangeStart..rangeEnd betroffene Kalendermonate (YYYY-MM). */
  affectedMonths: string[];
}

/** Antwortform der Vorschau-Route: hängt ein signiertes, zeitlich begrenztes Token an die
 *  Vorschau, damit der nachfolgende Speichern-Aufruf exakt die geprüfte Berechnung bestätigt
 *  (D2). */
export type WorkTimeChangePreviewResponse = WorkTimeChangePreview & { previewToken: string };

/** Ergebnis eines tatsächlichen Speicherns (nicht Dry-Run). */
export interface WorkTimeChangeResult {
  /** Die neu angelegte Periode. */
  period: WorkTimePeriod;
  /** Dieselbe Berechnung, die auch der Vorschau zugrunde lag (D2). */
  preview: WorkTimeChangePreview;
  /** ID der erzeugten model_change-Buchung, oder null, wenn balanceDelta 0 ist (D4). */
  transactionId: number | null;
}
