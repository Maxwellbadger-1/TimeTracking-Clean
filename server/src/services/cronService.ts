import * as cron from 'node-cron';
import { createBackup } from './backupService.js';
import { performYearEndRollover } from './yearEndRolloverService.js';
import { runOvertimeRecalcForAllUsers } from './overtimeRecalcRunner.js';
import logger from '../utils/logger.js';

/**
 * Cron Service - Scheduled Tasks
 * Handles automated backups and year-end rollover
 */

let backupTask: cron.ScheduledTask | null = null;
let yearEndRolloverTask: cron.ScheduledTask | null = null;
let overtimeRecalcTask: cron.ScheduledTask | null = null;

/**
 * Start automated backup scheduler
 * Default: Every day at 2:00 AM
 */
export function startBackupScheduler(): void {
  if (backupTask) {
    logger.warn('⚠️  Backup scheduler already running');
    return;
  }

  // Schedule: Every day at 2:00 AM Europe/Berlin
  // Cron format: minute hour day month weekday
  // "0 2 * * *" = At 02:00 every day
  //
  // timezone explizit: Das war der einzige der drei Zeitpläne ohne Angabe und lief damit
  // in der Zeitzone des Prozesses. Solange TZ=Europe/Berlin gesetzt ist, stimmt die Zeit —
  // fällt die Variable weg, feuerte das Backup in UTC, also 04:00 statt 02:00 Ortszeit.
  backupTask = cron.schedule(
    '0 2 * * *',
    () => {
      logger.info('🔄 Automated backup started...');
      try {
        createBackup();
        logger.info('✅ Automated backup completed');
      } catch (error) {
        logger.error({ err: error }, '❌ Automated backup failed');
      }
    },
    {
      timezone: 'Europe/Berlin', // CRITICAL: German timezone!
    }
  );

  logger.info('✅ Backup scheduler started (daily at 2:00 AM Europe/Berlin)');
}

/**
 * Stop backup scheduler
 */
export function stopBackupScheduler(): void {
  if (backupTask) {
    backupTask.stop();
    backupTask = null;
    logger.info('🛑 Backup scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): { running: boolean; schedule: string } {
  return {
    running: backupTask !== null,
    schedule: '0 2 * * * (Daily at 2:00 AM Europe/Berlin)',
  };
}

/**
 * Start year-end rollover scheduler
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Runs automatically at 00:05 AM on January 1st (Europe/Berlin timezone)
 * - Transfers vacation days and overtime hours to new year
 * - Creates audit trail for compliance
 *
 * CRITICAL: Uses Europe/Berlin timezone!
 * This ensures rollover happens at midnight German time (not UTC!)
 *
 * Cron format: minute hour day month weekday
 * "5 0 1 1 *" = At 00:05 on January 1st
 */
export function startYearEndRolloverScheduler(): void {
  if (yearEndRolloverTask) {
    logger.warn('⚠️  Year-end rollover scheduler already running');
    return;
  }

  // Schedule: January 1st at 00:05 AM (5 minutes after midnight)
  // We wait 5 minutes to ensure all time entries from Dec 31st are finalized
  yearEndRolloverTask = cron.schedule(
    '5 0 1 1 *',
    () => {
      logger.info('🎊 Automated year-end rollover started...');
      try {
        const currentYear = new Date().getFullYear();
        const result = performYearEndRollover(currentYear);

        if (result.success) {
          logger.info(
            {
              year: result.year,
              vacationUsers: result.vacationUsersProcessed,
              overtimeUsers: result.overtimeUsersProcessed,
            },
            '✅ Automated year-end rollover completed successfully'
          );
        } else {
          logger.error(
            { errors: result.errors },
            '❌ Automated year-end rollover failed'
          );
        }
      } catch (error) {
        logger.error({ err: error }, '❌ Automated year-end rollover crashed');
      }
    },
    {
      timezone: 'Europe/Berlin', // CRITICAL: German timezone!
    }
  );

  logger.info(
    '✅ Year-end rollover scheduler started (January 1st at 00:05 AM Europe/Berlin)'
  );
}

/**
 * Stop year-end rollover scheduler
 */
export function stopYearEndRolloverScheduler(): void {
  if (yearEndRolloverTask) {
    yearEndRolloverTask.stop();
    yearEndRolloverTask = null;
    logger.info('🛑 Year-end rollover scheduler stopped');
  }
}

/**
 * Get year-end rollover scheduler status
 */
export function getYearEndRolloverSchedulerStatus(): {
  running: boolean;
  schedule: string;
  timezone: string;
} {
  return {
    running: yearEndRolloverTask !== null,
    schedule: '5 0 1 1 * (January 1st at 00:05 AM)',
    timezone: 'Europe/Berlin',
  };
}

/**
 * Start overtime recalculation scheduler (WR-05, D-01, D-02)
 *
 * URSACHE (gemessen 28.08.2026, `.planning/debug/wal-abgehaengt-20260827.md`): Der
 * nächtliche Neuberechnungslauf lief bisher als eigener `npx tsx`-Prozess mit einer
 * zweiten Verbindung auf die Produktionsdatenbank und beendete diese Verbindung am Ende
 * selbst. SQLite räumte dabei WAL und SHM auf, sobald der beendende Prozess kurz die
 * exklusive Sperre bekam (nachts, wenn der Server idle ist) — der Serverprozess schrieb
 * danach in eine aus dem Dateisystem gelöste Datei. Das passierte jede Nacht. Dieser
 * Scheduler löst das, indem der Lauf im Serverprozess selbst über die geteilte
 * Verbindung (`overtimeRecalcRunner.ts`) stattfindet (D-01).
 *
 * ZEITWAHL: Genau 03:15, nicht 03:00 — um 03:00 läuft im selben Prozess bereits die
 * Feiertags-Aktualisierung (`server.ts`). Getrennte Uhrzeiten halten das Protokoll
 * eindeutig lesbar (D-02). Die Zeitzone `Europe/Berlin` ist zwingend, sonst liefe der
 * Lauf auf einem Server mit UTC-Systemzeit zwei Stunden verschoben.
 */
export function startOvertimeRecalcScheduler(): void {
  if (overtimeRecalcTask) {
    logger.warn('⚠️  Overtime recalc scheduler already running');
    return;
  }

  overtimeRecalcTask = cron.schedule(
    '15 3 * * *',
    async () => {
      try {
        await runOvertimeRecalcForAllUsers({ anlass: 'nachtlauf' });
      } catch (error) {
        logger.error({ err: error }, '❌ Overtime recalc scheduler run failed');
      }
    },
    {
      timezone: 'Europe/Berlin', // CRITICAL: German timezone!
    }
  );

  logger.info(
    '✅ Overtime recalc scheduler started (daily at 03:15 AM Europe/Berlin)'
  );
}

/**
 * Stop overtime recalculation scheduler
 */
export function stopOvertimeRecalcScheduler(): void {
  if (overtimeRecalcTask) {
    overtimeRecalcTask.stop();
    overtimeRecalcTask = null;
    logger.info('🛑 Overtime recalc scheduler stopped');
  }
}

/**
 * Get overtime recalc scheduler status
 */
export function getOvertimeRecalcSchedulerStatus(): {
  running: boolean;
  schedule: string;
  timezone: string;
} {
  return {
    running: overtimeRecalcTask !== null,
    schedule: '15 3 * * * (täglich 03:15)',
    timezone: 'Europe/Berlin',
  };
}
