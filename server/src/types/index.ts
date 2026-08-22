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
  /**
   * WR-03 (Code-Review Phase 11, Durchlauf 2): Hinweis darauf, dass die Antwort NICHT
   * über alle Nutzer geht.
   *
   * Sammelauswertungen überspringen seit der WR-03-Vereinzelung einen Nutzer mit
   * Datendefekt, statt für alle abzubrechen. Ohne dieses Feld war das Ergebnis
   * stillschweigend falsch: Der übersprungene Mitarbeiter erschien mit 0/0/0 und war in
   * der Oberfläche nicht von einem zu unterscheiden, der tatsächlich nichts gearbeitet
   * hat; die Gesamtsumme fiel entsprechend zu klein aus. Für eine Kennzahl, die als
   * Grundlage für Auszahlung und Abbau dient, ist eine stillschweigend falsche Zahl
   * schlechter als eine ausbleibende.
   *
   * Bewusst NEBEN `data` und nicht darin: Bestehende Aufrufer lesen `data` unverändert
   * weiter, das Feld ist rein additiv. Fehlt es, ist die Antwort vollständig.
   */
  dataQuality?: {
    skippedUserIds: number[];
    reason: 'missing_work_period';
    message: string;
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
  /** Phase 13 (13-CONTEXT.md D2): gesetzt, sobald die Periode per Soft-Delete weggenommen
   *  wurde (`softDeleteWorkPeriod()`). NULL = aktiv, für jeden Lesepfad sichtbar. */
  deletedAt: string | null;
  /** Nutzer, der die Periode weggenommen hat — zwingend gesetzt bei jedem Soft-Delete
   *  (T-13-08, Nachvollziehbarkeit). NULL, solange die Periode aktiv ist. */
  deletedBy: number | null;
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
  deletedAt: string | null;
  deletedBy: number | null;
}

// Stundenwechsel-Vertrag (Milestone v3.0, Phase 12, REQ-26 bis REQ-29) —
// D2: Vorschau und Speichern laufen über exakt dieselbe Codebahn, deshalb ist
// WorkTimeChangePreview der gemeinsame Rückgabetyp beider Pfade (kein "Dual Calculation
// System", siehe .claude/CLAUDE.md).
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
  /** Nutzer, für den die Berechnung lief. */
  userId: number;
  /** Stichtag der neuen Periode (YYYY-MM-DD, inklusiv), wie im Input übergeben. */
  validFrom: string;
  /** true, wenn validFrom in der Vergangenheit liegt und deshalb ein Rebuild bis heute
   *  ausgelöst wird (D3). */
  isRetroactive: boolean;
  /** Erster Tag des neu zu berechnenden Zeitraums (inklusiv, YYYY-MM-DD) — bei
   *  rückwirkendem Stichtag identisch mit validFrom. */
  rangeStart: string;
  /** Letzter Tag des neu zu berechnenden Zeitraums (inklusiv, YYYY-MM-DD) — heute bei
   *  rückwirkendem Stichtag, sonst validFrom selbst. */
  rangeEnd: string;
  /** Anzahl der Arbeitstage innerhalb von rangeStart..rangeEnd nach dem bisherigen Modell. */
  workingDaysInRange: number;
  /** Sollstunden im Zeitraum nach dem bisherigen (vor der Änderung geltenden) Modell. */
  targetHoursBefore: number;
  /** Sollstunden im Zeitraum nach dem neuen Modell (weeklyHours/workSchedule aus dem Input). */
  targetHoursAfter: number;
  /** targetHoursAfter - targetHoursBefore. Negative Werte bedeuten eine Saldogutschrift
   *  (weniger Soll bei gleichem Ist), positive Werte eine Saldobelastung. */
  targetHoursDelta: number;
  /** Überstundensaldo des Nutzers vor der Änderung (Stunden bleiben Stunden, D4 — keine
   *  Umrechnung des angesparten Saldos). */
  balanceBefore: number;
  /** Überstundensaldo des Nutzers nach Anwendung von balanceDelta. */
  balanceAfter: number;
  /** Die eine Differenzbuchung, die durch die neue Sollstunden-Basis entsteht (D4). 0 bei
   *  einem Stichtag in der Zukunft — dort gibt es noch keinen abzurechnenden Zeitraum. */
  balanceDelta: number;
  /** Die bislang gültige Periode zum Stichtag, oder null, wenn keine existiert (z. B. erster
   *  Wechsel eines Nutzers ohne Vorperiode im relevanten Zeitraum). */
  currentPeriod: { validFrom: string; weeklyHours: number; workSchedule: WorkSchedule | null } | null;
  /** true, wenn sich weder Sollstunden noch Tagesplan gegenüber der aktuell gültigen Periode
   *  ändern — die Oberfläche zeigt dann das Panel "nichts zu tun" statt eine Buchung anzubieten. */
  isNoOp: boolean;
  /** true, wenn der Stichtag nicht auf den Monatsersten fällt — die Oberfläche weist in
   *  diesem Fall auf die anteilige erste/letzte Periode hin. */
  midMonthEffective: boolean;
  /** Von rangeStart..rangeEnd betroffene Kalendermonate (YYYY-MM), zur Anzeige "neu gerechnet
   *  wird vom ... bis heute" in der Vorschau. */
  affectedMonths: string[];
}

/** Antwortform der Vorschau-Route: hängt ein signiertes, zeitlich begrenztes Token an die
 *  Vorschau, damit der nachfolgende Speichern-Aufruf exakt die geprüfte Berechnung bestätigt
 *  (D2). Die Berechnung selbst (WorkTimeChangePreview) kennt kein Token — das Token ist ein
 *  reines Transportkonzept der Route, nicht der Fachlogik. */
export type WorkTimeChangePreviewResponse = WorkTimeChangePreview & { previewToken: string };

/** Ergebnis eines tatsächlichen Speicherns (nicht Dry-Run). */
export interface WorkTimeChangeOutcome {
  /** Dieselbe Berechnung, die auch der Vorschau zugrunde lag (D2). */
  preview: WorkTimeChangePreview;
  /** Die neu angelegte Periode, oder null im Trockenlauf — dort wird die Periode innerhalb
   *  der Transaktion wieder zurückgerollt und existiert danach nicht. */
  period: UserWorkPeriod | null;
  /** ID der erzeugten model_change-Buchung, oder null, wenn balanceDelta 0 ist (D4: ein
   *  Stichtag in der Zukunft erzeugt keine Buchung). */
  transactionId: number | null;
}

// Korrigieren und rückgängig machen (Phase 13, REQ-30/REQ-31) —
// D1 (13-CONTEXT.md): zwei klar getrennte Aktionen mit unterschiedlicher Bedeutung, deshalb
// eigene Verträge statt eines gemeinsamen Typs mit Modus-Flag. D6: Vorschau und Speichern
// beider Aktionen teilen sich dieselben Rechenbausteine aus Phase 12 (workPeriodChangeService.ts)
// — kein "Dual Calculation System" (.claude/CLAUDE.md).

/** Periodenliste inklusive serverseitig berechneter Flags (DD-6, 13-02-PLAN.md). `UserWorkPeriod`
 *  bleibt die reine Abbildung der Tabellenzeile — dieser Typ steht bewusst daneben, nicht als
 *  Ersatz. Berechnet von `getWorkPeriodsWithFlags()` (`workPeriodService.ts`). */
export interface UserWorkPeriodListItem extends UserWorkPeriod {
  /** true für die erste (früheste, nicht weggenommene) Periode der Kette — Index 0 nach
   *  validFrom sortiert, KEIN Vergleich gegen users.hireDate (siehe DD-6). */
  isFirst: boolean;
  /** true für die zu heute aufgelöste Periode — über resolveWorkPeriodIn(), kein zweiter
   *  Intervallvergleich. */
  isCurrent: boolean;
}

/** Eingabe für „Stammdaten korrigieren" (D1): ändert eine BESTEHENDE Periode rückwirkend.
 *  Bewusst OHNE `userId` — der Nutzer ergibt sich aus der Periode (`periodId`), ein
 *  mitgeschickter abweichender `userId` wäre eine Angriffsfläche (IDOR). */
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
 *  13-UI-SPEC.md, Abschnitt „Datenvertrag" / „Korrektur-Vorschau". */
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
  /** Die korrigierte Periode, oder null im Trockenlauf. */
  period: UserWorkPeriod | null;
  /** ID der erzeugten Korrekturbuchung, oder null, wenn balanceDelta 0 ist. */
  transactionId: number | null;
}

/** Ergebnis einer Lösch-Vorschau- oder -Speicher-Berechnung (D2/D3) — Feldnamen aus
 *  13-UI-SPEC.md, Abschnitt „Lösch-Vorschau".
 *
 *  ABWEICHUNG VOM DATENVERTRAG (dokumentiert wie von 13-02-PLAN.md Task 2 verlangt): Die
 *  13-UI-SPEC nennt `reversedTransaction` im Singular; tatsächlich kann eine Periode mehr als
 *  eine `model_change`-Buchung tragen (die Umstellungsbuchung aus Phase 12 UND jede spätere
 *  Korrekturbuchung derselben Periode). Die Oberfläche zeigt in der Löschbestätigung die
 *  SUMME der Beträge — der Vertrag liefert deshalb die Liste, nicht eine einzelne Zeile. */
export interface WorkPeriodDeletionPreview {
  periodId: number;
  userId: number;
  /** Werte der zu löschenden Periode VOR der Löschung. */
  deletedPeriod: { validFrom: string; validTo: string | null; weeklyHours: number };
  /** Die Vorperiode, die die Lücke schließt (D3) — `newValidTo` ist ihr neues `validTo`
   *  (übernimmt das `validTo` der gelöschten Periode, ggf. `null` bei einer offenen letzten
   *  Periode). */
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

/** Eingabe für „Periode löschen" (D2). Bewusst OHNE `userId` — analog zu
 *  WorkPeriodCorrectionInput ergibt sich der Nutzer aus der Periode. */
export interface WorkPeriodDeletionInput {
  periodId: number;
  /** Pflichtbegründung (D7). */
  reason: string;
}
