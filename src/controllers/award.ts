// src/controllers/award.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import SeasonModel, { ISeasonDocument } from '../models/Season.js';
import LeagueModel from '../models/League.js';
import MovieOwnershipModel from '../models/MovieOwnership.js';
import AwardBonusModel from '../models/AwardBonus.js';
import {
  HttpStatus,
  sendSuccessResponse,
  sendErrorResponse,
  successResponse,
} from '../utils/response.js';

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

/**
 * Apply an award bonus to a studio for a movie
 * POST /api/seasons/:id/bonuses/apply
 */
async function applyAwardBonus(req: Request, res: Response) {
  try {
    // ✅ VALIDATION ERRORS
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(
        res,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Validation failed',
        errors.array().map((err: any) => ({
          field: err.path || err.param,
          message: err.msg,
          code: 'VALIDATION_ERROR',
        }))
      );
    }

    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const seasonId = req.params.id;
    const { categoryKey, movieId, result } = req.body as {
      categoryKey: string;
      movieId: string;
      result: 'nom' | 'win';
    };

    const season = await SeasonModel.findById(seasonId).lean<ISeasonDocument>();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user is league owner or commissioner
    const league = await LeagueModel.findById(season.leagueId).lean();

    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK
    const isOwner = String((league as any).ownerId) === userId;
    const isComm =
      Array.isArray((league as any).commissionerIds) &&
      (league as any).commissionerIds.some((id: any) => String(id) === userId);

    if (!isOwner && !isComm) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'Only league owners or commissioners can apply award bonuses'
      );
    }

    // Find award category configuration
    const cfg = (league as any).awardCategories?.find(
      (c: any) => c.key === categoryKey && c.enabled
    );

    // ✅ VALIDATION CHECK
    if (!cfg) {
      return sendErrorResponse(
        res,
        HttpStatus.BAD_REQUEST,
        'Category disabled or not found for this league'
      );
    }

    const points: number =
      result === 'win' ? cfg.winPoints : cfg.nominationPoints;

    // Find which studio owns this movie in this season
    const ownership = await MovieOwnershipModel.findOne({
      seasonId,
      movieId,
    }).lean();

    if (!ownership) {
      return sendErrorResponse(
        res,
        HttpStatus.BAD_REQUEST,
        'Movie not owned by any studio in this season'
      );
    }

    // ✅ CONFLICT CHECK
    // Check if bonus already applied
    const existing = await AwardBonusModel.findOne({
      seasonId,
      studioId: (ownership as any).studioId,
      movieId,
      categoryKey,
      result,
    }).lean();

    if (existing) {
      return sendErrorResponse(
        res,
        HttpStatus.CONFLICT,
        'Award bonus already applied for this category and result'
      );
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

    // ✅ CREATED RESPONSE (201)
    return res
      .status(HttpStatus.CREATED)
      .json(
        successResponse(
          { points, bonusId: bonus._id, bonus },
          undefined,
          'Award bonus applied successfully'
        )
      );
  } catch (err) {
    console.error('Error applying award bonus:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to apply award bonus'
    );
  }
}

/**
 * Get award bonuses for a season
 * GET /api/seasons/:id/bonuses
 */
async function getAwardBonuses(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const seasonId = req.params.id;

    const season = await SeasonModel.findById(seasonId).lean();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user has access
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK
    const isOwner = String((league as any).ownerId) === userId;
    const isComm =
      Array.isArray((league as any).commissionerIds) &&
      (league as any).commissionerIds.some((id: any) => String(id) === userId);

    // TODO: Add StudioOwner membership check
    if (!isOwner && !isComm) {
      return sendErrorResponse(res, HttpStatus.FORBIDDEN, 'Access denied');
    }

    const bonuses = await AwardBonusModel.find({ seasonId })
      .sort({ awardedAt: -1 })
      .lean();

    // ✅ ARRAY RESPONSE (not paginated)
    return sendSuccessResponse(res, bonuses);
  } catch (err) {
    console.error('Error fetching award bonuses:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch award bonuses'
    );
  }
}

/**
 * Delete an award bonus
 * DELETE /api/bonuses/:id
 */
async function deleteAwardBonus(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const bonus = await AwardBonusModel.findById(req.params.id);

    // ✅ NOT FOUND CHECK
    if (!bonus) {
      return sendErrorResponse(
        res,
        HttpStatus.NOT_FOUND,
        'Award bonus not found'
      );
    }

    const season = await SeasonModel.findById(bonus.seasonId).lean();

    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user is league owner or commissioner
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK
    const isOwner = String((league as any).ownerId) === userId;
    const isComm =
      Array.isArray((league as any).commissionerIds) &&
      (league as any).commissionerIds.some((id: any) => String(id) === userId);

    if (!isOwner && !isComm) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'Only league owners or commissioners can delete award bonuses'
      );
    }

    await bonus.deleteOne();

    // ✅ NO CONTENT RESPONSE (204)
    return res.status(HttpStatus.NO_CONTENT).send();
  } catch (err) {
    console.error('Error deleting award bonus:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to delete award bonus'
    );
  }
}

const awardController = {
  applyAwardBonus,
  getAwardBonuses,
  deleteAwardBonus,
};

export default awardController;
