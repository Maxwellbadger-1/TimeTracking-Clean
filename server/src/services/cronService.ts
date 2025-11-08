import * as cron from 'node-cron';
import { createBackup } from './backupService.js';
import logger from '../utils/logger.js';

/**
 * Cron Service - Scheduled Tasks
 * Handles automated backups and other scheduled operations
 */

let backupTask: cron.ScheduledTask | null = null;

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
