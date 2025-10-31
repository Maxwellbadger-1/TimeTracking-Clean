import type { Request, Response, NextFunction } from 'express';

/**
 * Error Handler Middleware
 */

export interface AppError extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Global error handler
 * Catches all errors and returns proper JSON response
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error('❌ Error:', {
    status: statusCode,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
}
