/**
 * Production-Grade Logger using Pino
 *
 * Features:
 * - Environment-based log levels
 * - Structured JSON logging in production
 * - Pretty formatting in development
 * - High performance (5-10x faster than Winston)
 * - Zero overhead in production
 */

import pino from 'pino';

// Determine log level based on environment
const getLogLevel = (): string => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

// Create logger instance
const logger = pino({
  level: getLogLevel(),

  // Pretty formatting in development only
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined, // JSON in production (for log aggregation tools)

  // Base context
  base: {
    env: process.env.NODE_ENV || 'development',
  },

  // Redact sensitive fields
  redact: {
    paths: ['password', 'token', 'authorization', 'cookie'],
    censor: '[REDACTED]',
  },
});

/**
 * Create child logger with additional context
 * Useful for adding userId, requestId, etc.
 */
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

export default logger;
