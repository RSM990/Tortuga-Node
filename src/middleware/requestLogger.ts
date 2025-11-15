/**
 * Request Logger Middleware
 *
 * Automatically logs all HTTP requests with:
 * - Method and path
 * - Status code
 * - Response time
 * - User ID (if authenticated)
 * - IP address
 *
 * Usage in server.ts or app.ts:
 *   import requestLogger from '@/middleware/requestLogger';
 *   app.use(requestLogger);
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

/**
 * Middleware to log HTTP requests
 */
const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to log when response is sent
  res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
    // Calculate request duration
    const duration = Date.now() - startTime;

    // Extract user ID if available (assuming req.userId from auth middleware)
    const userId = (req as any).userId || 'anonymous';

    // Get client IP (handle proxy headers)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Determine log level based on status code
    const statusCode = res.statusCode;
    let logLevel: 'error' | 'warn' | 'info' = 'info';

    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    }

    // Log the request
    logger[logLevel]('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      userId,
      ip,
      userAgent: req.get('user-agent'),
    });

    // Call the original end function
    return originalEnd.call(this, chunk, encoding, callback) as Response;
  };

  next();
};

export default requestLogger;
