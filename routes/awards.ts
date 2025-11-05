// src/routes/awards.ts
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import isAuth from '../middleware/is-auth.js';

import Season, { SeasonDoc } from '../models/Season.js';
import League from '../models/League.js';
import MovieOwnership from '../models/MovieOwnership.js';
import AwardBonus from '../models/AwardBonus.js';

const router = Router();

/**
 * Guard: owner or commissioner for the season's league
 * Expects :id = seasonId
 */
async function requireCommissionerForSeason(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const seasonId = req.params.id;
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const season = await Season.findById(seasonId).lean<SeasonDoc>();
    if (!season) return res.status(404).json({ message: 'Season not found' });

    const league = await League.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();
    if (!league) return res.status(404).json({ message: 'League not found' });

    const isOwner = String((league as any).ownerId) === String(userId);
    const isComm =
      Array.isArray((league as any).commissionerIds) &&
      (league as any).commissionerIds.some(
        (id: any) => String(id) === String(userId)
      );

    if (!isOwner && !isComm) {
      return res
        .status(403)
        .json({ message: 'Commissioner or owner role required' });
    }

    return next();
  } catch (e) {
    return next(e);
  }
}

/**
 * Apply an award bonus to the studio that owns the movie in this season.
 * POST /seasons/:id/bonuses/apply
 * Body: { categoryKey, movieId, result: 'nom'|'win' }
 */
router.post(
  '/seasons/:id/bonuses/apply',
  isAuth,
  requireCommissionerForSeason,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = req.params.id;
      const { categoryKey, movieId, result } = req.body as {
        categoryKey: string;
        movieId: string;
        result: 'nom' | 'win';
      };

      if (!categoryKey || !movieId || !['nom', 'win'].includes(result)) {
        return res.status(400).json({
          message: 'categoryKey, movieId, and valid result are required',
        });
      }

      const season = await Season.findById(seasonId).lean<SeasonDoc>();
      if (!season) return res.status(404).json({ message: 'Season not found' });

      const league = await League.findById(season.leagueId).lean();
      if (!league) return res.status(404).json({ message: 'League not found' });

      const cfg = (league as any).awardCategories?.find(
        (c: any) => c.key === categoryKey && c.enabled
      );
      if (!cfg) {
        return res
          .status(400)
          .json({ message: 'Category disabled or not found for this league' });
      }

      const points: number =
        result === 'win' ? cfg.winPoints : cfg.nominationPoints;

      const ownership = await MovieOwnership.findOne({
        seasonId,
        movieId,
      }).lean();
      if (!ownership) {
        return res.status(400).json({ message: 'Movie not owned this season' });
      }

      const bonus = await AwardBonus.create({
        leagueId: season.leagueId,
        seasonId,
        studioId: (ownership as any).studioId,
        movieId,
        categoryKey,
        result,
        points,
      });

      return res.status(201).json({ ok: true, points, bonusId: bonus._id });
    } catch (e) {
      return next(e);
    }
  }
);

export default router;
