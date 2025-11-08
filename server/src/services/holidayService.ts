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
 * Initialize holidays on server start
 * Loads current year + next 2 years
 */
export async function initializeHolidays(): Promise<void> {
  logger.info('🎄 Initializing holidays...');

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  try {
    for (const year of years) {
      await loadHolidaysForYear(year);
    }

    logger.info({ years }, `🎉 Holidays initialized successfully`);
  } catch (error) {
    logger.error({ err: error }, '❌ Error initializing holidays');
    // Don't throw - holidays are not critical for server start
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
