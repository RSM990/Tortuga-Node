// src/routes/dev.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import devController from '../controllers/dev.js';
import { devRevenueUpsertValidation } from '../validators/index.js';

const router = Router();

/**
 * Upsert weekly revenue for a movie (DEV only)
 * POST /api/dev/revenue/upsert
 */
router.post(
  '/revenue/upsert',
  devRevenueUpsertValidation,
  devController.upsertRevenue
);

export default router;
