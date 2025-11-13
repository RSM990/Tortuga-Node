// backend/src/routes/studios.ts
import { Router } from 'express';
import studioController from '../controllers/studio.js';
import isAuth from '../middleware/is-auth.js';
import requireLeagueMember from '../middleware/require-league-member.js';

const router = Router({ mergeParams: true });
/**
 * Routes mounted at /api/leagues/:leagueId/studios
 * All operations require authentication and league membership
 */

// Create studio in league
// POST /api/leagues/:leagueId/studios
router.post('/', isAuth, requireLeagueMember, studioController.createStudio);

// List studios in league
// GET /api/leagues/:leagueId/studios
router.get('/', isAuth, requireLeagueMember, studioController.getStudios);

// Get single studio
// GET /api/leagues/:leagueId/studios/:studioId
router.get(
  '/:studioId',
  isAuth,
  requireLeagueMember,
  studioController.getStudio
);

// Update studio
// PATCH /api/leagues/:leagueId/studios/:studioId
router.patch(
  '/:studioId',
  isAuth,
  requireLeagueMember,
  studioController.updateStudio
);

// Delete studio
// DELETE /api/leagues/:leagueId/studios/:studioId
router.delete(
  '/:studioId',
  isAuth,
  requireLeagueMember,
  studioController.deleteStudio
);

export default router;
