import { db } from '../database/connection.js';
import { recordVacationTransaction } from './vacationTransactionService.js';
import { formatDate, parseDate, getTodayString } from '../utils/timezone.js';
import logger from '../utils/logger.js';

/**
 * Deutsche Feldbezeichnungen für Korrekturbuchungen — konsistent mit den Labels in der
 * Admin-Oberfläche (VacationBalanceEditModal.tsx, VacationBalanceManagementPage.tsx).
 */
const CORRECTION_FIELD_LABELS = {
  entitlement: 'Anspruch',
  carryover: 'Übertrag',
  taken: 'Genommen',
} as const;

/**
 * Baut die Beschreibung einer Korrekturbuchung. Mit Begründung wird sie genannt; fehlt sie,
 * entsteht ein als solcher erkennbarer Ersatztext (Übergangsregel, bis Phase 8 ein
 * Eingabefeld für die Begründung in der Oberfläche ergänzt).
 */
function buildCorrectionDescription(
  field: keyof typeof CORRECTION_FIELD_LABELS,
  oldValue: number,
  newValue: number,
  reason: string | undefined
): string {
  const label = CORRECTION_FIELD_LABELS[field];
  return reason
    ? `Korrektur ${label} ${oldValue} → ${newValue} (Grund: ${reason})`
    : `Korrektur durch Admin: ${label} ${oldValue} → ${newValue}`;
}

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
  /** Begründung der Änderung. Leere Zeichenkette wird abgewiesen; fehlt das Feld ganz,
   *  entsteht ein gekennzeichneter Ersatztext (siehe buildCorrectionDescription). */
  reason?: string;
  /** Auslösender Admin. null nur für System-Automatismen. */
  actorId?: number | null;
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

  // VALIDATION: Check carryover against previous year's remaining balance
  if (data.carryover > 0) {
    const previousYear = data.year - 1;
    const previousBalance = getVacationBalance(data.userId, previousYear);

    if (previousBalance) {
      const maxCarryover = Math.min(previousBalance.remaining, 5); // Max 5 days per German law
      if (data.carryover > maxCarryover) {
        throw new Error(
          `Carryover cannot exceed previous year's remaining balance. ` +
          `Maximum allowed: ${maxCarryover} days (${previousYear} remaining: ${previousBalance.remaining} days, ` +
          `German law limit: 5 days)`
        );
      }
    } else {
      // No previous year balance → carryover should be 0
      throw new Error(
        `Cannot set carryover for ${data.year} because no vacation balance exists for ${previousYear}. ` +
        `Create ${previousYear} balance first, or set carryover to 0.`
      );
    }
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

export interface InitializeNewUserVacationAccountsResult {
  currentYear: number;
  currentYearEntitlement: number;
  nextYear: number;
  nextYearEntitlement: number;
}

/**
 * Legt für einen neu angelegten Mitarbeiter die Urlaubskonten des laufenden und des
 * Folgejahres an und bucht den jeweiligen Jahresanspruch ins Journal — pro-rata für das
 * laufende Jahr bei unterjährigem Eintritt, voller Jahreswert für das Folgejahr.
 *
 * WICHTIG — 0 ist ein gültiger Wert, aber keine gültige Buchung: `recordVacationTransaction`
 * weist `days = 0` ab. Ein Mitarbeiter mit 0 Urlaubstagen bekommt daher **keine**
 * Anspruchsbuchung — bewusst übersprungen statt geworfen, siehe `logger.info`.
 *
 * Kontoanlage und Buchung laufen atomar in einer gemeinsamen `db.transaction()`.
 *
 * Extrahiert aus der POST-/api/users-Route, damit die Buchungslogik unabhängig vom
 * HTTP-Layer getestet werden kann (siehe vacationEntitlementBooking.test.ts).
 */
export function initializeVacationAccountsForNewUser(params: {
  userId: number;
  hireDate: string;
  vacationDaysPerYear: number;
  createdBy: number | null;
}): InitializeNewUserVacationAccountsResult {
  const { userId, hireDate, vacationDaysPerYear, createdBy } = params;
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const currentYearEntitlement = calculateProRataVacationDays(
    hireDate,
    vacationDaysPerYear,
    currentYear
  );
  const nextYearEntitlement = vacationDaysPerYear;
  const hireYear = new Date(hireDate).getFullYear();

  const initialize = db.transaction(() => {
    // Current year (pro-rata for mid-year hires)
    upsertVacationBalance({
      userId,
      year: currentYear,
      entitlement: currentYearEntitlement,
      carryover: 0,
    });

    if (currentYearEntitlement === 0) {
      logger.info(
        { userId, year: currentYear },
        'ℹ️ 0 Urlaubstage bei Anlage — keine Anspruchsbuchung für das laufende Jahr (bewusst übersprungen)'
      );
    } else {
      const bookingDate = hireYear === currentYear ? hireDate : `${currentYear}-01-01`;
      const description = hireYear === currentYear
        ? `Jahresanspruch ${currentYear} (anteilig ab ${formatDate(parseDate(hireDate), 'dd.MM.')})`
        : `Jahresanspruch ${currentYear}`;

      recordVacationTransaction({
        userId,
        year: currentYear,
        date: bookingDate,
        type: 'entitlement',
        days: currentYearEntitlement,
        description,
        referenceType: 'system',
        createdBy,
      });
    }

    // Next year (full entitlement for planning)
    upsertVacationBalance({
      userId,
      year: nextYear,
      entitlement: nextYearEntitlement,
      carryover: 0,
    });

    if (nextYearEntitlement === 0) {
      logger.info(
        { userId, year: nextYear },
        'ℹ️ 0 Urlaubstage bei Anlage — keine Anspruchsbuchung für das Folgejahr (bewusst übersprungen)'
      );
    } else {
      recordVacationTransaction({
        userId,
        year: nextYear,
        date: `${nextYear}-01-01`,
        type: 'entitlement',
        days: nextYearEntitlement,
        description: `Jahresanspruch ${nextYear}`,
        referenceType: 'system',
        createdBy,
      });
    }
  });

  initialize();

  return { currentYear, currentYearEntitlement, nextYear, nextYearEntitlement };
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

    // VALIDATION: Check carryover against previous year's remaining balance
    if (data.carryover > 0) {
      const previousYear = existing.year - 1;
      const previousBalance = getVacationBalance(existing.userId, previousYear);

      if (previousBalance) {
        const maxCarryover = Math.min(previousBalance.remaining, 5); // Max 5 days per German law
        if (data.carryover > maxCarryover) {
          throw new Error(
            `Carryover cannot exceed previous year's remaining balance. ` +
            `Maximum allowed: ${maxCarryover} days (${previousYear} remaining: ${previousBalance.remaining} days, ` +
            `German law limit: 5 days)`
          );
        }
      } else {
        // No previous year balance → carryover should be 0
        throw new Error(
          `Cannot set carryover for ${existing.year} because no vacation balance exists for ${previousYear}. ` +
          `Create ${previousYear} balance first, or set carryover to 0.`
        );
      }
    }
  }

  if (data.taken !== undefined) {
    if (data.taken < 0 || data.taken > 100) {
      throw new Error('Taken must be between 0 and 100 days');
    }
  }

  // Eine leere Zeichenkette ist keine Begründung — nur ein fehlendes Feld darf den
  // Ersatztext auslösen (Übergangsregel, siehe REQ-06).
  if (data.reason !== undefined && data.reason.trim() === '') {
    throw new Error(
      'Eine Begründung darf nicht als leere Zeichenkette gesendet werden — Feld weglassen, ' +
      'wenn keine Begründung angegeben werden soll.'
    );
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

  const reason = data.reason?.trim();
  const correctionDate = getTodayString();

  // UPDATE und Korrekturbuchungen laufen atomar — ein Statuswechsel ohne die zugehörige
  // Buchung (oder umgekehrt) darf nicht entstehen.
  const applyUpdate = db.transaction(() => {
    db.prepare(query).run(...params);

    (Object.keys(CORRECTION_FIELD_LABELS) as Array<keyof typeof CORRECTION_FIELD_LABELS>).forEach(
      (field) => {
        const newValue = data[field];
        if (newValue === undefined) return;

        const oldValue = existing[field];
        // Gebucht wird die Differenz, nicht der neue Wert. Bei `taken` bedeutet ein
        // sinkender Wert weniger Verbrauch = mehr verfügbar (Vorzeichen gedreht).
        const diff = field === 'taken' ? oldValue - newValue : newValue - oldValue;

        if (Math.abs(diff) < 1e-9) return; // unverändert — keine Buchung

        recordVacationTransaction({
          userId: existing.userId,
          year: existing.year,
          date: correctionDate,
          type: 'correction',
          days: diff,
          description: buildCorrectionDescription(field, oldValue, newValue, reason),
          referenceType: 'manual',
          createdBy: data.actorId ?? null,
        });
      }
    );
  });

  applyUpdate();

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
 *
 * Bucht pro angelegtem Konto den Jahresanspruch (`entitlement`) und, falls aus dem
 * Vorjahr ein Rest übertragen wird, zusätzlich den Übertrag (`carryover`) ins Journal.
 * Diese Funktion ist der einzige Ort, an dem `vacation_balance`-Zeilen per Massenanlage
 * entstehen — sowohl über die Admin-Route als auch über `performYearEndRollover()`,
 * das sie für den Jahreswechsel aufruft. Beide Pfade profitieren dadurch automatisch
 * von derselben Buchungslogik.
 *
 * Idempotent: Ein zweiter Lauf überspringt bereits existierende Konten (`if (existing)
 * continue`) — dadurch entstehen auch keine doppelten Buchungen.
 *
 * @param createdBy Wer die Massenanlage ausgelöst hat (Admin-User-ID). `null` für
 *   System-Automatismen (z. B. Cron-Jahreswechsel ohne menschlichen Auslöser).
 */
export function bulkInitializeVacationBalances(
  year: number,
  createdBy: number | null = null
): number {
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
    // PROFESSIONAL STANDARD: Transfer ALL remaining vacation days (unlimited!)
    // NO expiry date - vacation days remain valid indefinitely
    const previousYear = year - 1;
    const previousBalance = getVacationBalance(user.id, previousYear);
    const carryover =
      previousBalance && previousBalance.remaining > 0
        ? previousBalance.remaining // Transfer ALL days
        : 0;

    // Konto und Buchungen laufen atomar — eine Kontoanlage ohne die zugehörige
    // Anspruchs-/Übertragsbuchung (oder umgekehrt) darf nicht entstehen.
    const createBalanceAndBook = db.transaction(() => {
      db.prepare(`
        INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
        VALUES (?, ?, ?, ?, 0)
      `).run(user.id, year, entitlement, carryover);

      // 0 ist ein gültiger Wert, aber keine gültige Buchung — recordVacationTransaction
      // weist days=0 ab. Bewusst überspringen statt zu werfen.
      if (entitlement === 0) {
        logger.info(
          { userId: user.id, year },
          'ℹ️ 0 Urlaubstage — keine Anspruchsbuchung bei Massenanlage/Jahreswechsel (bewusst übersprungen)'
        );
      } else {
        const hireYear = new Date(userDetails.hireDate).getFullYear();
        const bookingDate = hireYear === year ? userDetails.hireDate : `${year}-01-01`;
        const description = hireYear === year
          ? `Jahresanspruch ${year} (anteilig ab ${formatDate(parseDate(userDetails.hireDate), 'dd.MM.')})`
          : `Jahresanspruch ${year}`;

        recordVacationTransaction({
          userId: user.id,
          year,
          date: bookingDate,
          type: 'entitlement',
          days: entitlement,
          description,
          referenceType: 'system',
          createdBy,
        });
      }

      // Übertrag ist die Bewegung, die am ehesten hinterfragt wird — Herkunftsjahr
      // gehört in die Beschreibung, damit der Kontoauszug sie erklärt.
      if (carryover > 0) {
        recordVacationTransaction({
          userId: user.id,
          year,
          date: `${year}-01-01`,
          type: 'carryover',
          days: carryover,
          description: `Übertrag aus ${previousYear}`,
          referenceType: 'system',
          createdBy,
        });
      }
    });

    createBalanceAndBook();
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
  /** users.vacationDaysPerYear — used by the admin UI to pre-fill new balances */
  defaultEntitlement: number;
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
    defaultEntitlement: number;
    entitlement: number;
    carryover: number;
    taken: number;
    remaining: number;
    hasBalance: boolean;
  }>;
}
