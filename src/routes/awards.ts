// src/routes/awards.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import isAuth from '../middleware/is-auth.js';
import awardController from '../controllers/award.js';
import { applyAwardBonusValidation } from '../validators/index.js';

const router = Router();

// Apply award bonus
router.post(
  '/seasons/:id/bonuses/apply',
  isAuth,
  applyAwardBonusValidation,
  awardController.applyAwardBonus
);

// Get award bonuses for a season
router.get('/seasons/:id/bonuses', isAuth, awardController.getAwardBonuses);

// Delete award bonus
router.delete('/bonuses/:id', isAuth, awardController.deleteAwardBonus);

export default router;
