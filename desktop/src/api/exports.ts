/**
 * Export API Client
 *
 * Functions for downloading CSV and DATEV exports from the backend.
 * Uses universalFetch for Tauri compatibility (session cookies work cross-origin).
 */

import { SERVER_BASE_URL } from './client';
import { universalFetch } from '../lib/tauriHttpClient';

/**
 * Export DATEV CSV
 *
 * DATEV format for tax accountants (Steuerberater).
 * Always exports ALL users regardless of filter.
 *
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Blob containing the CSV file
 * @throws Error if request fails
 */
export async function exportDATEV(
  startDate: string,
  endDate: string
): Promise<Blob> {
  const params = new URLSearchParams({ startDate, endDate });
  const url = `${SERVER_BASE_URL}/api/exports/datev?${params}`;

  const response = await universalFetch(url, {
    method: 'GET',
    credentials: 'include', // Send session cookie
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DATEV Export fehlgeschlagen: ${error}`);
  }

  return response.blob();
}

/**
 * Export Historical CSV
 *
 * Comprehensive export with all data (users, time entries, absences, overtime, vacation).
 * Can optionally filter by specific user.
 *
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param userId Optional user ID to filter (if undefined, exports all users)
 * @returns Blob containing the CSV file
 * @throws Error if request fails
 */
export async function exportHistoricalCSV(
  startDate: string,
  endDate: string,
  userId?: number
): Promise<Blob> {
  const params = new URLSearchParams({ startDate, endDate });
  if (userId !== undefined) {
    params.append('userId', userId.toString());
  }

  const url = `${SERVER_BASE_URL}/api/exports/historical/csv?${params}`;

  const response = await universalFetch(url, {
    method: 'GET',
    credentials: 'include', // Send session cookie
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CSV Export fehlgeschlagen: ${error}`);
  }

  return response.blob();
}
