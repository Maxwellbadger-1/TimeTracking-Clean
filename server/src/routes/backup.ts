import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupStats,
  getBackupPath,
} from '../services/backupService.js';
import { getSchedulerStatus } from '../services/cronService.js';
import type { ApiResponse } from '../types/index.js';

const router = Router();

/**
 * GET /api/backup
 * List all backups
 */
router.get(
  '/',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response<ApiResponse<any[]>>) => {
    try {
      const backups = listBackups();
      res.json({
        success: true,
        data: backups,
      });
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list backups',
      });
    }
  }
);

/**
 * GET /api/backup/stats
 * Get backup statistics
 */
router.get(
  '/stats',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response<ApiResponse<any>>) => {
    try {
      const stats = getBackupStats();
      const schedulerStatus = getSchedulerStatus();

      res.json({
        success: true,
        data: {
          ...stats,
          scheduler: schedulerStatus,
        },
      });
    } catch (error) {
      console.error('❌ Failed to get backup stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get backup stats',
      });
    }
  }
);

/**
 * GET /api/backup/download/:filename
 * Download a backup file
 */
router.get(
  '/download/:filename',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { filename } = req.params;

      if (!filename) {
        res.status(400).json({
          success: false,
          error: 'Backup filename is required',
        });
        return;
      }

      // Get full path to backup file
      const backupPath = getBackupPath(filename);

      // Security check: File must exist
      if (!fs.existsSync(backupPath)) {
        res.status(404).json({
          success: false,
          error: 'Backup file not found',
        });
        return;
      }

      // Send file for download
      console.log(`📥 Sending backup file for download: ${filename}`);
      res.download(backupPath, filename, (err) => {
        if (err) {
          console.error('❌ Failed to send backup file:', err);
          // Don't send response if headers already sent
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'Failed to download backup',
            });
          }
        } else {
          console.log(`✅ Backup file downloaded successfully: ${filename}`);
        }
      });
    } catch (error) {
      console.error('❌ Failed to download backup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download backup',
      });
    }
  }
);

/**
 * POST /api/backup
 * Create new backup manually
 */
router.post(
  '/',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response<ApiResponse<{ filename: string }>>) => {
    try {
      const backupPath = createBackup();
      const filename = backupPath.split('/').pop() || '';

      res.json({
        success: true,
        data: { filename },
        message: 'Backup created successfully',
      });
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create backup',
      });
    }
  }
);

/**
 * POST /api/backup/restore/:filename
 * Restore database from backup
 * WARNING: This will overwrite the current database!
 */
router.post(
  '/restore/:filename',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const { filename } = req.params;

      if (!filename) {
        res.status(400).json({
          success: false,
          error: 'Backup filename is required',
        });
        return;
      }

      restoreBackup(filename);

      res.json({
        success: true,
        message: 'Database restored successfully. Please restart the server.',
      });
    } catch (error) {
      console.error('❌ Failed to restore backup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup',
      });
    }
  }
);

/**
 * DELETE /api/backup/:filename
 * Delete a specific backup
 */
router.delete(
  '/:filename',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const { filename } = req.params;

      if (!filename) {
        res.status(400).json({
          success: false,
          error: 'Backup filename is required',
        });
        return;
      }

      deleteBackup(filename);

      res.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    } catch (error) {
      console.error('❌ Failed to delete backup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup',
      });
    }
  }
);

export default router;
