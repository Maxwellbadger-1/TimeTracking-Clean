/**
 * Date Range Utilities
 *
 * Converts year/month filters to start/end date strings for API requests
 */

/**
 * Convert year and optional month to date range
 *
 * @param year Year (e.g., 2026)
 * @param month Optional month (1-12). If undefined, returns full year range.
 * @returns Object with startDate and endDate in YYYY-MM-DD format
 *
 * @example
 * getDateRangeFromFilters(2026)
 * // Returns: { startDate: '2026-01-01', endDate: '2026-12-31' }
 *
 * getDateRangeFromFilters(2026, 3)
 * // Returns: { startDate: '2026-03-01', endDate: '2026-03-31' }
 */
export function getDateRangeFromFilters(
  year: number,
  month?: number
): { startDate: string; endDate: string } {
  if (month) {
    // Specific month: First day to last day
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month (0 = previous month's last day)

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  } else {
    // Full year: January 1st to December 31st
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }
}

/**
 * Format Date object to YYYY-MM-DD string
 *
 * @param date Date object
 * @returns Formatted date string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
