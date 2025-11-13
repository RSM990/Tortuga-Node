// src/routes/compute.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import isAuth from '../middleware/is-auth.js';
import computeController from '../controllers/compute.js';
import { computeWeekValidation } from '../validators/index.js';

const router = Router();

// Compute weekly rankings
router.post(
  '/seasons/:id/compute/week/:weekIndex',
  isAuth,
  computeWeekValidation,
  computeController.computeWeek
);

// Get studio weekly totals
router.get(
  '/seasons/:id/studios/week/:weekIndex',
  isAuth,
  computeController.getStudioWeeklyTotals
);

// Get weekly ranking
router.get(
  '/seasons/:id/rankings/week/:weekIndex',
  isAuth,
  computeController.getWeeklyRanking
);

export default router;
