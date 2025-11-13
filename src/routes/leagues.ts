// src/routes/leagues.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import isAuth from '../middleware/is-auth.js';
import leagueController from '../controllers/league.js';
import seasonController from '../controllers/season.js';
import {
  createLeagueValidation,
  updateLeagueValidation,
} from '../validators/index.js';
import studioRoutes from './studios.js';

const router = Router();

// Check slug availability (public)
router.get('/slug/check', leagueController.checkSlugAvailability);

// List leagues
router.get('/', isAuth, leagueController.getLeagues);

// Create league
router.post('/', isAuth, createLeagueValidation, leagueController.createLeague);

// Get league by ID or slug
router.get('/:idOrSlug', isAuth, leagueController.getLeague);

// Update league
router.patch(
  '/:id',
  isAuth,
  updateLeagueValidation,
  leagueController.updateLeague
);

// Delete league
router.delete('/:id', isAuth, leagueController.deleteLeague);

// Get league members
router.get('/:idOrSlug/members', isAuth, leagueController.getLeagueMembers);

// Get league standings
router.get('/:idOrSlug/standings', isAuth, leagueController.getLeagueStandings);

// List seasons for a league
router.get('/:leagueId/seasons', isAuth, seasonController.getSeasons);

// router.use('/:leagueId/studios', studioRoutes);

export default router;
