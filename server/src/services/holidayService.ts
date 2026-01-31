import db from '../database/connection.js';
import logger from '../utils/logger.js';

/**
 * Holiday Service - Manages public holidays (Feiertage)
 * Uses feiertageapi.de for automatic updates
 */

interface Holiday {
  date: string;
  name: string;
  federal: number; // 1 = bundesweit, 0 = nur Bayern
}

interface SpikeTimeApiResponse {
  Datum: string;
  Feiertag: {
    Name: string;
    Laender: Array<{ Name: string; Abkuerzung: string }>;
  };
}

/**
 * Fetch holidays from SpikeTime API
 * API: https://www.spiketime.de/feiertagapi/feiertage/BY/YYYY
 */
async function fetchHolidaysFromAPI(year: number): Promise<Holiday[]> {
  const url = `https://www.spiketime.de/feiertagapi/feiertage/BY/${year}`;

  logger.info({ year, url }, '🔄 Fetching holidays from API');

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as SpikeTimeApiResponse[];
    const holidays: Holiday[] = [];

    // Bundesweite Feiertage (gelten überall)
    const federalHolidays = [
      'Neujahr',
      'Karfreitag',
      'Ostermontag',
      'Erster Mai',
      'Christi Himmelfahrt',
      'Pfingstmontag',
      'Tag der deutschen Einheit',
      '1. Weihnachtstag',
      '2. Weihnachtstag'
    ];

    for (const item of data) {
      // Convert date from ISO format "2025-01-01T00:00:00" to "2025-01-01"
      const date = item.Datum.split('T')[0];
      const name = item.Feiertag.Name;
      const isFederal = federalHolidays.includes(name) ? 1 : 0;

      holidays.push({
        date,
        name,
        federal: isFederal
      });
    }

    logger.info({ year, count: holidays.length }, `✅ Fetched holidays from API`);
    return holidays;

  } catch (error) {
    logger.error({ err: error, year }, `❌ Error fetching holidays from API`);
    throw error;
  }
}

/**
 * Save holidays to database
 */
function saveHolidaysToDatabase(holidays: Holiday[]): number {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO holidays (date, name, federal)
    VALUES (?, ?, ?)
  `);

  let count = 0;

  for (const holiday of holidays) {
    stmt.run(holiday.date, holiday.name, holiday.federal);
    count++;
  }

  return count;
}

/**
 * Load holidays for a specific year from API and save to database
 */
export async function loadHolidaysForYear(year: number): Promise<number> {
  logger.info({ year }, `📅 Loading holidays for year`);

  try {
    // Fetch from API
    const holidays = await fetchHolidaysFromAPI(year);

    // Save to database
    const count = saveHolidaysToDatabase(holidays);

    logger.info({ year, count }, `✅ Successfully loaded holidays`);
    return count;

  } catch (error) {
    logger.error({ err: error, year }, `❌ Error loading holidays`);
    throw error;
  }
}

/**
 * Get the earliest hire year from all users
 * Used to determine how far back we need to load holidays
 */
export function getEarliestHireYear(): number {
  const result = db
    .prepare('SELECT MIN(hireDate) as earliestHire FROM users WHERE deletedAt IS NULL')
    .get() as { earliestHire: string | null };

  if (!result?.earliestHire) {
    // No users yet, default to current year
    return new Date().getFullYear();
  }

  return new Date(result.earliestHire).getFullYear();
}

/**
 * Get the maximum year for which we have holidays in the database
 */
export function getMaxHolidayYear(): number {
  const result = db
    .prepare('SELECT MAX(SUBSTR(date, 1, 4)) as maxYear FROM holidays')
    .get() as { maxYear: string | null };

  if (!result?.maxYear) {
    // No holidays yet
    return new Date().getFullYear() - 1;
  }

  return parseInt(result.maxYear, 10);
}

/**
 * Ensure holidays are loaded for a specific year
 * Lazy-loads from API if not present in database
 */
export async function ensureYearCoverage(year: number): Promise<void> {
  const exists = db
    .prepare('SELECT 1 FROM holidays WHERE date LIKE ? LIMIT 1')
    .get(`${year}-%`);

  if (!exists) {
    logger.info({ year }, '⚠️  Year not in database, loading holidays...');
    await loadHolidaysForYear(year);
  }
}

/**
 * Initialize holidays on server start
 * Loads from earliest hire year to current year + 3 years ahead
 *
 * PROFESSIONAL STANDARD:
 * - Historical data: Needed for correct overtime calculations
 * - Future data: Needed for absence planning (typically +2 to +3 years)
 * - This matches Personio, SAP SuccessFactors, Workday approach
 */
export async function initializeHolidays(): Promise<void> {
  logger.info('🎄 Initializing holidays...');

  const currentYear = new Date().getFullYear();
  const earliestHireYear = getEarliestHireYear();
  const futureYears = 3; // Standard: +3 years ahead

  const startYear = earliestHireYear;
  const endYear = currentYear + futureYears;

  logger.info({
    earliestHireYear,
    currentYear,
    endYear,
    totalYears: endYear - startYear + 1
  }, '📅 Loading holidays for range');

  try {
    for (let year = startYear; year <= endYear; year++) {
      await loadHolidaysForYear(year);
    }

    logger.info({
      yearsLoaded: `${startYear}-${endYear}`,
      totalYears: endYear - startYear + 1
    }, `🎉 Holidays initialized successfully`);
  } catch (error) {
    logger.error({ err: error }, '❌ Error initializing holidays');
    // Don't throw - holidays are not critical for server start
  }
}

/**
 * Auto-update holidays to ensure we always have coverage
 * Called by cron job daily
 *
 * Checks if we need to load new years and updates accordingly
 */
export async function autoUpdateHolidays(): Promise<void> {
  logger.info('🔄 Auto-updating holidays...');

  try {
    const currentYear = new Date().getFullYear();
    const maxYear = getMaxHolidayYear();
    const futureYears = 3;
    const targetMaxYear = currentYear + futureYears;

    // Check if we need to load new years
    if (maxYear < targetMaxYear) {
      logger.info({
        currentMaxYear: maxYear,
        targetMaxYear,
        yearsToLoad: targetMaxYear - maxYear
      }, '📅 Loading missing future years');

      for (let year = maxYear + 1; year <= targetMaxYear; year++) {
        await loadHolidaysForYear(year);
      }

      logger.info({ yearsLoaded: `${maxYear + 1}-${targetMaxYear}` }, '✅ Auto-update complete');
    } else {
      logger.info({ maxYear }, '✅ Holiday coverage up-to-date');
    }

    // Also check if we need to backfill (in case earliest hire date changed)
    const earliestHireYear = getEarliestHireYear();
    const minYear = parseInt(
      (db.prepare('SELECT MIN(SUBSTR(date, 1, 4)) as minYear FROM holidays')
        .get() as { minYear: string | null })?.minYear || String(currentYear),
      10
    );

    if (earliestHireYear < minYear) {
      logger.info({
        earliestHireYear,
        currentMinYear: minYear,
        yearsToBackfill: minYear - earliestHireYear
      }, '📅 Backfilling missing historical years');

      for (let year = earliestHireYear; year < minYear; year++) {
        await loadHolidaysForYear(year);
      }

      logger.info({ yearsLoaded: `${earliestHireYear}-${minYear - 1}` }, '✅ Backfill complete');
    }

  } catch (error) {
    logger.error({ err: error }, '❌ Error in auto-update holidays');
    // Don't throw - this runs in background
  }
}

/**
 * Get all holidays for a specific year
 */
export function getHolidaysForYear(year: number): Holiday[] {
  const holidays = db
    .prepare('SELECT date, name, federal FROM holidays WHERE date LIKE ? ORDER BY date')
    .all(`${year}-%`) as Holiday[];

  return holidays;
}

/**
 * Get all holidays for a specific month
 */
export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  const monthStr = String(month).padStart(2, '0');
  const holidays = db
    .prepare('SELECT date, name, federal FROM holidays WHERE date LIKE ? ORDER BY date')
    .all(`${year}-${monthStr}-%`) as Holiday[];

  return holidays;
}

/**
 * Check if a specific date is a holiday
 */
export function isHoliday(date: string): boolean {
  const result = db
    .prepare('SELECT id FROM holidays WHERE date = ?')
    .get(date);

  return result !== undefined;
}

/**
 * Get holiday name for a specific date (if exists)
 */
export function getHolidayName(date: string): string | null {
  const result = db
    .prepare('SELECT name FROM holidays WHERE date = ?')
    .get(date) as { name: string } | undefined;

  return result?.name || null;
}
