// src/routes/ownership.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import isAuth from '../middleware/is-auth.js';
import ownershipController from '../controllers/ownership.js';
import { enforceAcquisitionWindow } from '../middleware/enforceAcquisitionWindow.js';
import { createOwnershipValidation } from '../validators/index.js';

const router = Router();

// Create movie ownership
router.post(
  '/',
  isAuth,
  enforceAcquisitionWindow,
  createOwnershipValidation,
  ownershipController.createOwnership
);

// Get ownerships by season
router.get(
  '/by-season/:seasonId',
  isAuth,
  ownershipController.getOwnershipsBySeason
);

// Get ownerships by studio
router.get(
  '/by-studio/:studioId',
  isAuth,
  ownershipController.getOwnershipsByStudio
);

// Retire ownership (sell/drop movie)
router.patch('/:id/retire', isAuth, ownershipController.retireOwnership);

export default router;
