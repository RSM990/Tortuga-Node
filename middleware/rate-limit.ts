import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

export const apiRateLimit: RequestHandler = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 120, // was `max` in older versions
  standardHeaders: true, // send RateLimit-* headers
  legacyHeaders: false, // disable X-RateLimit-* headers
  skip: (req) => req.path === '/healthz' || req.path === '/api/healthz',
});
