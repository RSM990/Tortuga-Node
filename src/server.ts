import 'dotenv/config';
import http from 'node:http';
import app from './app.js';
import logger from './config/logger.js';

const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0'; // ← Critical for ALB

const server = http.createServer(app);

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') throw error;
  switch (error.code) {
    case 'EACCES':
      logger.error(`Port ${port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.listen(port, host, () => {
  logger.info('API server started', { host, port });
  logger.info('Health check available', {
    url: `http://${host}:${port}/healthz`,
  });
  logger.info('Environment', {
    environment: process.env.NODE_ENV || 'development',
  });
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received. Closing server gracefully...`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { promise, reason });
});
