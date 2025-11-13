// src/controllers/award.ts
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import SeasonModel, { ISeasonDocument } from '../models/Season.js';
import LeagueModel from '../models/League.js';
import MovieOwnershipModel from '../models/MovieOwnership.js';
import AwardBonusModel from '../models/AwardBonus.js';

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

/**
 * Apply an award bonus to a studio for a movie
 * POST /api/seasons/:id/bonuses/apply
 */
async function applyAwardBonus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Validation failed',
        data: errors.array(),
      });
    }

    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const seasonId = req.params.id;
    const { categoryKey, movieId, result } = req.body as {
      categoryKey: string;
      movieId: string;
      result: 'nom' | 'win';
    };

    const season = await SeasonModel.findById(seasonId).lean<ISeasonDocument>();
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    // Verify user is league owner or commissioner
    const league = await LeagueModel.findById(season.leagueId).lean();
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    const isOwner = String((league as any).ownerId) === userId;
    const isComm =
      Array.isArray((league as any).commissionerIds) &&
      (league as any).commissionerIds.some(
        (id: any) => String(id) === userId
      );

    if (!isOwner && !isComm) {
      return res.status(403).json({
        message: 'Only league owners or commissioners can apply award bonuses',
      });
    }

    // Find award category configuration
    const cfg = (league as any).awardCategories?.find(
      (c: any) => c.key === categoryKey && c.enabled
    );

    if (!cfg) {
      return res.status(400).json({
        message: 'Category disabled or not found for this league',
      });
    }

    const points: number =
      result === 'win' ? cfg.winPoints : cfg.nominationPoints;

    // Find which studio owns this movie in this season
    const ownership = await MovieOwnershipModel.findOne({
      seasonId,
      movieId,
    }).lean();

    if (!ownership) {
      return res.status(400).json({
        message: 'Movie not owned by any studio in this season',
      });
    }

    // Check if bonus already applied
    const existing = await AwardBonusModel.findOne({
      seasonId,
      studioId: (ownership as any).studioId,
      movieId,
      categoryKey,
      result,
    }).lean();

    if (existing) {
      return res.status(409).json({
        message: 'Award bonus already applied for this category and result',
      });
    }

    // Create award bonus
    const bonus = await AwardBonusModel.create({
      leagueId: season.leagueId,
      seasonId,
      studioId: (ownership as any).studioId,
      movieId,
      categoryKey,
      result,
      points,
    });

    return res.status(201).json({
      ok: true,
      points,
      bonusId: bonus._id,
      bonus,
    });
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get award bonuses for a season
 * GET /api/seasons/:id/bonuses
 */
async function getAwardBonuses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const seasonId = req.params.id;

    const season = await SeasonModel.findById(seasonId).lean();
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    // Verify user has access
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    const isOwner = String((league as any).ownerId) === userId;
    const isComm =
      Array.isArray((league as any).commissionerIds) &&
      (league as any).commissionerIds.some(
        (id: any) => String(id) === userId
      );

    // TODO: Add StudioOwner membership check
    if (!isOwner && !isComm) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bonuses = await AwardBonusModel.find({ seasonId })
      .sort({ awardedAt: -1 })
      .lean();

    return res.json(bonuses);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Delete an award bonus
 * DELETE /api/bonuses/:id
 */
async function deleteAwardBonus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const bonus = await AwardBonusModel.findById(req.params.id);
    if (!bonus) {
      return res.status(404).json({ message: 'Award bonus not found' });
    }

    const season = await SeasonModel.findById(bonus.seasonId).lean();
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    // Verify user is league owner or commissioner
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    const isOwner = String((league as any).ownerId) === userId;
    const isComm =
      Array.isArray((league as any).commissionerIds) &&
      (league as any).commissionerIds.some(
        (id: any) => String(id) === userId
      );

    if (!isOwner && !isComm) {
      return res.status(403).json({
        message: 'Only league owners or commissioners can delete award bonuses',
      });
    }

    await bonus.deleteOne();

    return res.status(204).send();
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

const awardController = {
  applyAwardBonus,
  getAwardBonuses,
  deleteAwardBonus,
};

export default awardController;
