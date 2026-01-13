import * as cron from 'node-cron';
import { createBackup } from './backupService.js';
import { performYearEndRollover } from './yearEndRolloverService.js';
import logger from '../utils/logger.js';

/**
 * Cron Service - Scheduled Tasks
 * Handles automated backups and year-end rollover
 */

let backupTask: cron.ScheduledTask | null = null;
let yearEndRolloverTask: cron.ScheduledTask | null = null;

/**
 * Start automated backup scheduler
 * Default: Every day at 2:00 AM
 */
export function startBackupScheduler(): void {
  if (backupTask) {
    logger.warn('⚠️  Backup scheduler already running');
    return;
  }

  // Schedule: Every day at 2:00 AM
  // Cron format: minute hour day month weekday
  // "0 2 * * *" = At 02:00 every day
  backupTask = cron.schedule('0 2 * * *', () => {
    logger.info('🔄 Automated backup started...');
    try {
      createBackup();
      logger.info('✅ Automated backup completed');
    } catch (error) {
      logger.error({ err: error }, '❌ Automated backup failed');
    }
  });

  logger.info('✅ Backup scheduler started (daily at 2:00 AM)');
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
    schedule: '0 2 * * * (Daily at 2:00 AM)',
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
