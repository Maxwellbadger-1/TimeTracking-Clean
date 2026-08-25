/**
 * Export API Client
 *
 * Functions for downloading CSV and DATEV exports from the backend.
 * Uses universalFetch for Tauri compatibility (session cookies work cross-origin).
 */

import { SERVER_BASE_URL } from './client';
import { universalFetch } from '../lib/tauriHttpClient';

/** Obergrenze fuer die angezeigte Fehlermeldung (T-14.2-06-04, Denial-of-Service durch einen
 * sehr langen Fehlertext). Nach dieser Laenge wird mit "…" gekuerzt. */
const MAX_ERROR_MESSAGE_LENGTH = 500;

/**
 * Typwache: prueft, ob ein ausgewerteter JSON-Koerper ein Feld `error` vom Typ `string` mit
 * nicht-leerem Inhalt traegt — genau das Feld, das der Server bei einem Fehler sendet
 * (server/src/routes/exports.ts:119-129 und :283-289). Es gibt bewusst KEINE Pruefung auf ein
 * Feld `code` — der Server sendet keines (F-6, D-08-Korrektur).
 */
function isErrorBody(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string' &&
    (value as { error: string }).error.trim().length > 0
  );
}

/**
 * Sicherheitsschranke gegen interne Details (T-14.2-06-01, Threat Model dieses Plans).
 * Ein Fehlertext, der einen Stacktrace, eine SQL-Anweisung oder einen Dateipfad traegt, darf
 * niemals im Hinweisfenster erscheinen — sonst gelangen interne Implementierungsdetails an
 * eine Person, die sie nicht sehen soll. Erkennungsmuster: eine Zeile, die (nach optionalem
 * Leerraum) mit "at " beginnt (Stacktrace-Zeile), der SQLite-Fehlercode-Praefix `SQLITE_`,
 * die SQL-Schluesselwoerter SELECT/INSERT/UPDATE gefolgt von einem Leerzeichen, sowie Unix-
 * ("/home/") und Windows-Dateipfade ("C:\\"). Trifft eines davon zu, wird NICHT der Originalwert
 * angezeigt, sondern der Fallback-Satz — der Originalwert geht ausschliesslich in console.error.
 */
function containsInternalDetails(text: string): boolean {
  if (/^\s*at .+/m.test(text)) return true;
  if (text.includes('SQLITE_')) return true;
  if (/\b(SELECT|INSERT|UPDATE)\s/.test(text)) return true;
  if (text.includes('/home/')) return true;
  if (text.includes('C:\\')) return true;
  return false;
}

/**
 * Packt den Fehlerkoerper einer nicht-ok Antwort aus (F-6). Vorbild: client.ts:99-113
 * (response.clone().text() vorhalten, response.json() versuchen, Fallback bei Parse-Fehler).
 *
 * Reihenfolge:
 * 1. Koerper EINMAL als Text lesen und vorhalten. universalFetch (tauriHttpClient.ts:129-133)
 *    liefert eine echte `Response`-Instanz, `clone()` ist also verfuegbar; der Fallback
 *    (einmaliges `response.text()`) greift nur, falls das doch nicht der Fall sein sollte —
 *    der Koerper wird so oder so nur einmal konsumiert.
 * 2. Text als JSON auswerten. Traegt das Ergebnis ein nicht-leeres `error`-Feld, ist das die
 *    Meldung — nach der Sicherheitsschranke oben.
 * 3. Sonst: kein JSON, kein `error`-Feld, oder Sicherheitsschranke greift — Fallback-Satz mit
 *    HTTP-Statuscode. Der Rohtext geht NIE in die Meldung, nur in console.error (gekuerzt).
 */
async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  let rawText: string;
  try {
    rawText = await response.clone().text();
  } catch {
    rawText = await response.text();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }

  if (isErrorBody(parsed)) {
    const message = parsed.error;
    if (containsInternalDetails(message)) {
      console.error('Export-Fehlerkoerper enthaelt interne Details, wird nicht angezeigt:', {
        status: response.status,
        rawTextPreview: message.substring(0, 200),
      });
      return `${fallback} (HTTP ${response.status})`;
    }
    return message.length > MAX_ERROR_MESSAGE_LENGTH
      ? `${message.substring(0, MAX_ERROR_MESSAGE_LENGTH)}…`
      : message;
  }

  console.error('Export-Antwortkoerper ist kein auswertbares JSON mit Feld "error":', {
    status: response.status,
    rawTextPreview: rawText.substring(0, 200),
  });
  return `${fallback} (HTTP ${response.status})`;
}

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
    throw new Error(
      await extractErrorMessage(
        response,
        'DATEV-Export fehlgeschlagen. Bitte versuchen Sie es erneut oder wenden Sie sich an die Administration.'
      )
    );
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
    throw new Error(
      await extractErrorMessage(
        response,
        'CSV-Export fehlgeschlagen. Bitte versuchen Sie es erneut oder wenden Sie sich an die Administration.'
      )
    );
  }

  return response.blob();
}
