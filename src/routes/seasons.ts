// src/routes/seasons.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import isAuth from '../middleware/is-auth.js';
import seasonController from '../controllers/season.js';
import { createSeasonValidation } from '../validators/index.js';

const router = Router();

// Create season
router.post(
  '/',
  isAuth,
  createSeasonValidation,
  seasonController.createSeason
);

// Get season by ID
router.get('/:id', isAuth, seasonController.getSeason);

// Update season
router.patch('/:id', isAuth, seasonController.updateSeason);

// Delete season
router.delete('/:id', isAuth, seasonController.deleteSeason);

export default router;
