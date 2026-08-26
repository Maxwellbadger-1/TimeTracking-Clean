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
  /** F-2 (Phase 14.2, NB-2): Wochenstunden der HEUTE gueltigen Periode aus
   *  `user_work_periods`, serverseitig aufgeloest von `getAllUsers()`. NULL/undefined, wenn
   *  heute keine Periode gilt oder der Erzeuger dieses Objekts sie nicht mitliefert (nur
   *  `GET /api/users` und `GET /api/users/active` tun das).
   *
   *  Die Stammdatenfelder `weeklyHours`/`workSchedule` bleiben unveraendert — sie sind die
   *  bearbeitbaren Stammdaten (EditUserModal), diese drei Felder sind der Anzeigekontext.
   *  Wer eine Zahl ANZEIGT, nimmt diese Felder; wer Stammdaten BEARBEITET, nimmt die alten.
   *  Spiegel von `UserPublic` im Server (server/src/types/index.ts). */
  currentWeeklyHours?: number | null;
  /** F-2: Tagesplan der HEUTE gueltigen Periode, oder NULL. Siehe `currentWeeklyHours`. */
  currentWorkSchedule?: WorkSchedule | null;
  /** F-2: Erster Geltungstag der HEUTE gueltigen Periode (YYYY-MM-DD), oder NULL. */
  currentValidFrom?: string | null;
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

/**
 * Spiegel von `UserWorkPeriod` (server/src/types/index.ts) — die reine Periode OHNE
 * Listenflags.
 *
 * WR-05 (Code-Review Phase 13): Diese Trennung ist spiegelbildlich zur Server-Trennung
 * `UserWorkPeriod` vs. `UserWorkPeriodListItem`. Nur `GET /api/work-periods`
 * (`getWorkPeriodsWithFlags()`) liefert `isFirst`/`isCurrent`. Die beiden
 * Ergebnisverträge `WorkPeriodCorrectionOutcome.period` und `WorkTimeChangeResult.period`
 * kommen aus `getWorkPeriodById()` bzw. `createWorkPeriod()` und tragen die Flags NICHT —
 * würden sie den Typ mit Pflichtflags verwenden, versprächen sie Laufzeitwerte, die nie
 * ankommen, und der Compiler liesse einen Zugriff darauf wortlos durch (`undefined` dort,
 * wo `boolean` zugesagt ist). Genau die Fehlerklasse, wegen der `isCurrent` überhaupt vom
 * Client in den Server gewandert ist (DD-35).
 */
export interface WorkTimePeriodBase {
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

/** Spiegel von UserWorkPeriodListItem: die Periode MIT den serverseitig gesetzten
 *  Listenflags. Nur `GET /api/work-periods` liefert diese Form. */
export interface WorkTimePeriod extends WorkTimePeriodBase {
  /** Phase 13 (13-UI-SPEC.md, „Typerweiterung — ausdrücklich für den Planer"): true für die
   *  erste (früheste, nicht weggenommene) Periode der Kette. Kommt serverseitig von
   *  `getWorkPeriodsWithFlags()` (13-02-PLAN.md DD-6) — bewusst NICHT im Frontend aus der
   *  Listenposition abgeleitet, weil das falsch würde, sobald die Liste je gefiltert,
   *  begrenzt oder anders sortiert wird (dann wäre „die erste Zeile" nicht mehr „die erste
   *  Periode"). */
  isFirst: boolean;
  /** Phase 13: true für die zu heute aufgelöste Periode (server: über resolveWorkPeriodIn(),
   *  kein zweiter Intervallvergleich). Aus demselben Grund wie isFirst nicht im Frontend
   *  abgeleitet. */
  isCurrent: boolean;
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
  /** Die neu angelegte Periode. WR-05: ohne Listenflags — der Server liefert hier das
   *  Ergebnis von createWorkPeriod(), nicht getWorkPeriodsWithFlags(). */
  period: WorkTimePeriodBase;
  /** Dieselbe Berechnung, die auch der Vorschau zugrunde lag (D2). */
  preview: WorkTimeChangePreview;
  /** ID der erzeugten model_change-Buchung, oder null, wenn balanceDelta 0 ist (D4). */
  transactionId: number | null;
}

// Korrigieren und rückgängig machen (Phase 13, REQ-30/REQ-31) — zeichengleiche Spiegelung von
// server/src/types/index.ts (Plan 13-02). D1 (13-CONTEXT.md): zwei getrennte Aktionen mit
// eigener Bedeutung, deshalb eigene Verträge statt eines Typs mit Modus-Flag. Die Hooks in
// useWorkTimeChange.ts (Plan 13-07) rechnen nichts nach — die Servermeldung/-antwort wird
// unverändert durchgereicht (D7).
//
// Simplifikation gegenüber dem Server: `WorkPeriodCorrectionOutcome.period` und
// `WorkPeriodDeletionOutcome.deletedPeriod`/`previousPeriod` referenzieren serverseitig
// `UserWorkPeriod | null` bzw. Teilausschnitte davon — inklusive `deletedAt`/`deletedBy`
// (Phase-13-Buchhaltungsfelder aus Migration 013). Die Desktop-Spiegelung verwendet an der
// einen Stelle, wo eine vollständige Periode zurückkommt (WorkPeriodCorrectionOutcome.period),
// den Desktop-Typ `WorkTimePeriodBase`. `deletedAt`/`deletedBy` sind für die Oberfläche dieser
// Phase ohne Bedeutung: eine gerade korrigierte Periode ist per Definition nicht gelöscht.
//
// WR-05 (Code-Review Phase 13): Hier steht BEWUSST `WorkTimePeriodBase` und nicht
// `WorkTimePeriod`. Die Flags isFirst/isCurrent liefert ausschliesslich
// `GET /api/work-periods` (`getWorkPeriodsWithFlags()`); dieser Ergebnisvertrag kommt aus
// `getWorkPeriodById()` und trägt sie NICHT. Der frühere Typ versprach damit Laufzeitwerte,
// die nie ankommen — ein Zugriff auf `outcome.period.isFirst` wäre wortlos durchgegangen und
// hätte `undefined` geliefert.
export interface WorkPeriodCorrectionInput {
  periodId: number;
  /** Inklusiv, YYYY-MM-DD — der ggf. verschobene Beginn der korrigierten Periode. */
  validFrom: string;
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
  /** Pflichtbegründung (D7) — wird im Service geprüft, nicht nur in der Route. */
  reason: string;
}

/** Ergebnis einer Korrektur-Vorschau- oder -Speicher-Berechnung — Feldnamen exakt aus
 *  13-UI-SPEC.md, Abschnitt „Datenvertrag" / „Korrektur-Vorschau", zeichengleich zur
 *  Serverfassung (server/src/types/index.ts). */
export interface WorkPeriodCorrectionPreview {
  periodId: number;
  userId: number;
  /** true, wenn die Korrektur die Vergangenheit berührt und deshalb ein Rebuild bis heute
   *  ausgelöst wird (D4). */
  isRetroactive: boolean;
  /** Erster Tag des neu zu berechnenden Zeitraums (inklusiv, YYYY-MM-DD). */
  rangeFrom: string;
  /** Letzter Tag des neu zu berechnenden Zeitraums (inklusiv, YYYY-MM-DD). */
  rangeTo: string;
  /** Anzahl der Arbeitstage innerhalb von rangeFrom..rangeTo. */
  workingDays: number;
  /** Sollstunden im Zeitraum vor der Korrektur. */
  targetHoursBefore: number;
  /** Sollstunden im Zeitraum nach der Korrektur. */
  targetHoursAfter: number;
  /** targetHoursAfter - targetHoursBefore. */
  targetHoursDelta: number;
  /** Überstundensaldo des Nutzers vor der Korrektur. */
  balanceBefore: number;
  /** Überstundensaldo des Nutzers nach Anwendung von balanceDelta. */
  balanceAfter: number;
  /** Die eine Differenzbuchung, die durch die Korrektur entsteht (D4). */
  balanceDelta: number;
  /** true, wenn Eingabe und bisherige Werte identisch sind — eine No-Op-Korrektur ist laut
   *  13-UI-SPEC ein Validierungsfehler, kein stiller Erfolg (anders als bei
   *  WorkTimeChangePreview.isNoOp). */
  isNoOp: boolean;
  /** Werte der Periode VOR der Korrektur — für die Periodenkennung im Dialog. */
  period: {
    validFrom: string;
    validTo: string | null;
    weeklyHours: number;
    workSchedule: WorkSchedule | null;
  };
  /** Nur gesetzt, wenn `validFrom` verschoben wird — die Vorperiode wächst/schrumpft mit. */
  previousPeriod: { validFrom: string; weeklyHours: number; newValidTo: string } | null;
  /** Von rangeFrom..rangeTo betroffene Kalendermonate (YYYY-MM). */
  affectedMonths: string[];
}

/** Antwortform der Korrektur-Vorschau-Route (Muster: WorkTimeChangePreviewResponse). */
export type WorkPeriodCorrectionPreviewResponse = WorkPeriodCorrectionPreview & { previewToken: string };

/** Ergebnis eines tatsächlichen Korrektur-Speicherns (nicht Dry-Run). */
export interface WorkPeriodCorrectionOutcome {
  /** Dieselbe Berechnung, die auch der Vorschau zugrunde lag. */
  preview: WorkPeriodCorrectionPreview;
  /** Die korrigierte Periode, oder null im Trockenlauf. Server: `getWorkPeriodById()` liefert
   *  ein reines `UserWorkPeriod` OHNE isFirst/isCurrent — deshalb WorkTimePeriodBase (WR-05,
   *  siehe Simplifikationsvermerk oben). */
  period: WorkTimePeriodBase | null;
  /** ID der erzeugten Korrekturbuchung, oder null, wenn balanceDelta 0 ist. */
  transactionId: number | null;
}

/** Eingabe für „Periode löschen" (D2). Bewusst OHNE `userId` — analog zu
 *  WorkPeriodCorrectionInput ergibt sich der Nutzer aus der Periode. */
export interface WorkPeriodDeletionInput {
  periodId: number;
  /** Pflichtbegründung (D7). */
  reason: string;
}

/** Ergebnis einer Lösch-Vorschau- oder -Speicher-Berechnung (D2/D3) — Feldnamen aus
 *  13-UI-SPEC.md, Abschnitt „Lösch-Vorschau", zeichengleich zur Serverfassung.
 *
 *  ABWEICHUNG VOM DATENVERTRAG (wie schon server-seitig in 13-02-PLAN.md Task 2 dokumentiert):
 *  Die 13-UI-SPEC nennt `reversedTransaction` im Singular; tatsächlich kann eine Periode mehr
 *  als eine `model_change`-Buchung tragen. Der Vertrag liefert deshalb die Liste
 *  `reversedTransactions`, nicht eine einzelne Zeile — diese Spiegelung übernimmt exakt die
 *  Serverfassung. */
export interface WorkPeriodDeletionPreview {
  periodId: number;
  userId: number;
  /** Werte der zu löschenden Periode VOR der Löschung. */
  deletedPeriod: { validFrom: string; validTo: string | null; weeklyHours: number };
  /** Die Vorperiode, die die Lücke schließt (D3) — `newValidTo` ist ihr neues `validTo`. */
  previousPeriod: { validFrom: string; weeklyHours: number; newValidTo: string | null };
  /** Alle Buchungen, die durch die Löschung storniert (per Gegenbuchung ausgeglichen) werden. */
  reversedTransactions: Array<{ id: number; date: string; hours: number }>;
  /** Erster Tag des Rebuilds (= validFrom der gelöschten Periode), inklusiv, YYYY-MM-DD. */
  rebuildFrom: string;
  balanceBefore: number;
  balanceAfter: number;
  balanceDelta: number;
  affectedMonths: string[];
}

/** Antwortform der Lösch-Vorschau-Route (Muster: WorkTimeChangePreviewResponse). */
export type WorkPeriodDeletionPreviewResponse = WorkPeriodDeletionPreview & { previewToken: string };

/** Ergebnis eines tatsächlichen Löschens (nicht Dry-Run). */
export interface WorkPeriodDeletionOutcome {
  preview: WorkPeriodDeletionPreview;
  /** IDs aller erzeugten Gegenbuchungen (D2 — Storno statt Löschung, sichtbar im Auszug). */
  reversalTransactionIds: number[];
}
