/**
 * Winston Logger Configuration
 *
 * Provides centralized logging for the Tortuga backend.
 *
 * Features:
 * - Environment-based log levels
 * - File rotation (5MB max, 5 files kept)
 * - Separate error log file
 * - Pretty console output in development
 * - JSON format for production parsing
 *
 * Usage:
 *   import logger from '@/config/logger';
 *
 *   logger.error('Database connection failed', { error });
 *   logger.warn('Slow query detected', { duration, query });
 *   logger.info('User logged in', { userId });
 *   logger.debug('Processing request', { requestId, data });
 */

import winston from 'winston';
import path from 'path';

// Determine environment and log level
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'warn');

// Define log format for production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.json()
);

// Define log format for development (readable)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : '';
    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaString}`;
  })
);

// Create logs directory path
const logsDir = path.join(process.cwd(), 'logs');

// Create Winston logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: { service: 'tortuga-api' },
  transports: [
    // Error logs - separate file for quick access to errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined logs - all log levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development for immediate feedback
if (isDevelopment) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        developmentFormat
      ),
    })
  );
}

// Log the logger configuration on startup
logger.info('Logger initialized', {
  level: logLevel,
  environment: process.env.NODE_ENV || 'development',
  isDevelopment,
});

export default logger;
