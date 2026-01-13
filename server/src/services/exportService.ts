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
import { getDailyTargetHours } from '../utils/workingDays.js';
import { getUserById } from './userService.js';

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

    for (const user of users) {
      // Get full user object with workSchedule for accurate daily target hours
      const fullUser = getUserById(user.id);
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

      // Add time entries
      for (const entry of timeEntries) {
        // CRITICAL: Use getDailyTargetHours() to respect individual work schedules
        // For part-time employees with unequal distribution (Mo 8h, Fr 2h), this gives correct daily target
        const dailyTargetHours = getDailyTargetHours(fullUser, entry.date);
        const overtime = entry.hours - dailyTargetHours;

        rows.push([
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
        ].join(';'));
      }

      // Add absences
      for (const absence of absences) {
        const absenceType = absence.type === 'vacation' ? 'Urlaub'
          : absence.type === 'sick' ? 'Krank'
          : absence.type === 'overtime_comp' ? 'Überstundenausgleich'
          : 'Unbezahlt';

        rows.push([
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
        ].join(';'));
      }
    }

    // Create CSV with UTF-8 BOM (for Excel/DATEV compatibility)
    const csv = '\uFEFF' + header.join(';') + '\n' + rows.join('\n');

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
    let users: User[];
    if (userId) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
      users = user ? [user] : [];
    } else {
      users = db.prepare('SELECT * FROM users ORDER BY lastName, firstName').all() as User[];
    }

    // Get time entries
    const timeEntriesQuery = userId
      ? 'SELECT * FROM time_entries WHERE userId = ? AND date >= date(?) AND date <= date(?) ORDER BY date'
      : 'SELECT * FROM time_entries WHERE date >= date(?) AND date <= date(?) ORDER BY date';

    const timeEntries = userId
      ? db.prepare(timeEntriesQuery).all(userId, startDate, endDate) as TimeEntry[]
      : db.prepare(timeEntriesQuery).all(startDate, endDate) as TimeEntry[];

    // Get absences
    const absencesQuery = userId
      ? 'SELECT * FROM absence_requests WHERE userId = ? AND startDate <= date(?) AND endDate >= date(?) ORDER BY startDate'
      : 'SELECT * FROM absence_requests WHERE startDate <= date(?) AND endDate >= date(?) ORDER BY startDate';

    const absences = userId
      ? db.prepare(absencesQuery).all(userId, endDate, startDate) as AbsenceRequest[]
      : db.prepare(absencesQuery).all(endDate, startDate) as AbsenceRequest[];

    // Get overtime balance
    const overtimeQuery = userId
      ? 'SELECT * FROM overtime_balance WHERE userId = ? AND month >= ? AND month <= ? ORDER BY month'
      : 'SELECT * FROM overtime_balance WHERE month >= ? AND month <= ? ORDER BY month';

    const startMonth = startDate.substring(0, 7);
    const endMonth = endDate.substring(0, 7);

    const overtimeBalance = userId
      ? db.prepare(overtimeQuery).all(userId, startMonth, endMonth)
      : db.prepare(overtimeQuery).all(startMonth, endMonth);

    // Get vacation balance
    const startYear = parseInt(startDate.substring(0, 4));
    const endYear = parseInt(endDate.substring(0, 4));
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

    const vacationBalanceQuery = userId
      ? `SELECT * FROM vacation_balance WHERE userId = ? AND year IN (${years.join(',')}) ORDER BY year`
      : `SELECT * FROM vacation_balance WHERE year IN (${years.join(',')}) ORDER BY year`;

    const vacationBalance = userId
      ? db.prepare(vacationBalanceQuery).all(userId)
      : db.prepare(vacationBalanceQuery).all();

    // Calculate statistics
    const totalWorkingHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalOvertime = overtimeBalance.reduce((sum: number, entry: any) => sum + entry.overtime, 0);

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
      overtimeBalance: overtimeBalance as any[],
      vacationBalance: vacationBalance as any[],
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
    lines.push(`Export Date;${data.metadata.exportDate}`);
    lines.push(`Start Date;${data.metadata.startDate}`);
    lines.push(`End Date;${data.metadata.endDate}`);
    lines.push(`Retention Period;${data.metadata.retentionPeriod}`);
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
      ].join(';'));
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
      ].join(';'));
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
      ].join(';'));
    }
    lines.push('');

    // Statistics
    lines.push('STATISTICS');
    lines.push(`Total Users;${data.statistics.totalUsers}`);
    lines.push(`Total Time Entries;${data.statistics.totalTimeEntries}`);
    lines.push(`Total Absences;${data.statistics.totalAbsences}`);
    lines.push(`Total Working Hours;${data.statistics.totalWorkingHours.toFixed(2)}`);
    lines.push(`Total Overtime;${data.statistics.totalOvertime.toFixed(2)}`);

    return '\uFEFF' + lines.join('\n');
  } catch (error) {
    logger.error({ err: error }, '❌ Error converting historical export to CSV');
    throw error;
  }
}
