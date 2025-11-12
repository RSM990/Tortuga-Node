// backend/src/routes/studios.ts
import { Router } from 'express';
import studioController from '../controllers/studio.js';
import isAuth from '../middleware/is-auth.js'; // ✅ Default import
import requireLeagueMember from '../middleware/require-league-member.js'; // ✅ Default import

const router = Router();

/**
 * NESTED ROUTES UNDER /leagues/:leagueId/studios
 * All studio operations require authentication and league membership
 */

// Create studio in league
router.post(
  '/leagues/:leagueId/studios',
  isAuth,
  requireLeagueMember, // Ensure user is member of this league
  studioController.createStudio
);

// List studios in league
router.get(
  '/leagues/:leagueId/studios',
  isAuth,
  requireLeagueMember,
  studioController.getStudios
);

// Get single studio (still nested for consistency)
router.get(
  '/leagues/:leagueId/studios/:studioId',
  isAuth,
  requireLeagueMember,
  studioController.getStudio
);

// Update studio
router.patch(
  '/leagues/:leagueId/studios/:studioId',
  isAuth,
  requireLeagueMember,
  studioController.updateStudio
);

// Delete studio
router.delete(
  '/leagues/:leagueId/studios/:studioId',
  isAuth,
  requireLeagueMember,
  studioController.deleteStudio
);

export default router;
