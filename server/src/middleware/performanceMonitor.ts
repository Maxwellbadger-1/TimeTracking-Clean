/**
 * Performance Monitoring Middleware
 *
 * Features:
 * - Logs slow API endpoints (>1000ms)
 * - Tracks request duration
 * - Identifies performance bottlenecks
 * - Production-ready monitoring
 *
 * Usage:
 * import { performanceMonitor } from './middleware/performanceMonitor.js';
 * app.use(performanceMonitor);
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * Performance thresholds (milliseconds)
 */
const PERFORMANCE_THRESHOLDS = {
  SLOW: 1000,      // 1 second - Log as warning
  VERY_SLOW: 3000, // 3 seconds - Log as error
  CRITICAL: 5000,  // 5 seconds - Critical performance issue
} as const;

/**
 * Track request performance
 */
interface PerformanceStats {
  method: string;
  url: string;
  duration: number;
  statusCode: number;
  timestamp: string;
}

/**
 * In-memory performance stats (last 100 slow requests)
 */
const slowRequestsHistory: PerformanceStats[] = [];
const MAX_HISTORY = 100;

/**
 * Performance monitoring middleware
 * Logs slow API requests and tracks performance metrics
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  // Skip for health check and test endpoints
  if (req.path === '/api/health' || req.path === '/api/test') {
    next();
    return;
  }

  const startTime = Date.now();

  // Intercept response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const stats: PerformanceStats = {
      method: req.method,
      url: req.originalUrl || req.url,
      duration,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
    };

    // Log based on severity
    if (duration >= PERFORMANCE_THRESHOLDS.CRITICAL) {
      logger.error({
        ...stats,
        severity: 'CRITICAL',
        threshold: PERFORMANCE_THRESHOLDS.CRITICAL,
      }, '🔴 CRITICAL: Very slow API endpoint detected');

      addToHistory(stats);
    } else if (duration >= PERFORMANCE_THRESHOLDS.VERY_SLOW) {
      logger.error({
        ...stats,
        severity: 'HIGH',
        threshold: PERFORMANCE_THRESHOLDS.VERY_SLOW,
      }, '⚠️ Very slow API endpoint');

      addToHistory(stats);
    } else if (duration >= PERFORMANCE_THRESHOLDS.SLOW) {
      logger.warn({
        ...stats,
        severity: 'MEDIUM',
        threshold: PERFORMANCE_THRESHOLDS.SLOW,
      }, '⏱️ Slow API endpoint');

      addToHistory(stats);
    } else {
      // Log all requests in debug mode
      logger.debug({
        ...stats,
        severity: 'OK',
      }, '✅ API request completed');
    }
  });

  next();
}

/**
 * Add slow request to history (circular buffer)
 */
function addToHistory(stats: PerformanceStats): void {
  slowRequestsHistory.push(stats);

  // Keep only last MAX_HISTORY entries
  if (slowRequestsHistory.length > MAX_HISTORY) {
    slowRequestsHistory.shift();
  }
}

/**
 * Get performance statistics
 * Useful for admin dashboard or monitoring endpoints
 */
export function getPerformanceStats(): {
  slowRequests: PerformanceStats[];
  averageDuration: number;
  slowestRequest: PerformanceStats | null;
  totalSlowRequests: number;
} {
  if (slowRequestsHistory.length === 0) {
    return {
      slowRequests: [],
      averageDuration: 0,
      slowestRequest: null,
      totalSlowRequests: 0,
    };
  }

  const averageDuration = slowRequestsHistory.reduce((sum, req) => sum + req.duration, 0) / slowRequestsHistory.length;
  const slowestRequest = slowRequestsHistory.reduce((slowest, current) =>
    current.duration > slowest.duration ? current : slowest
  );

  return {
    slowRequests: [...slowRequestsHistory].reverse(), // Most recent first
    averageDuration: Math.round(averageDuration),
    slowestRequest,
    totalSlowRequests: slowRequestsHistory.length,
  };
}

/**
 * Clear performance history
 * Useful for testing or resetting metrics
 */
export function clearPerformanceHistory(): void {
  slowRequestsHistory.length = 0;
  logger.info('Performance history cleared');
}
