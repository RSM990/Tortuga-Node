// src/controllers/season.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import SeasonModel from '../models/Season.js';
import LeagueModel from '../models/League.js';
import {
  HttpStatus,
  parsePaginationParams,
  sendPaginatedResponse,
  sendSuccessResponse,
  sendErrorResponse,
  successResponse,
} from '../utils/response.js';

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

/**
 * Create a new season
 * POST /api/seasons
 */
async function createSeason(req: Request, res: Response) {
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

    const { leagueId, label, startDate, endDate, weekCount } = req.body;

    // Verify user can create seasons in this league (owner or commissioner)
    const league = await LeagueModel.findById(leagueId)
      .select('ownerId commissionerIds')
      .lean();

    // ✅ NOT FOUND CHECK
    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK
    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    if (!isOwner && !isComm) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'Only league owners or commissioners can create seasons'
      );
    }

    const season = await SeasonModel.create({
      leagueId,
      label,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      weekCount,
    });

    // ✅ CREATED RESPONSE (201)
    return res
      .status(HttpStatus.CREATED)
      .json(successResponse(season, undefined, 'Season created successfully'));
  } catch (err) {
    console.error('Error creating season:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create season'
    );
  }
}

/**
 * Get season by ID
 * GET /api/seasons/:id
 */
async function getSeason(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const season = await SeasonModel.findById(req.params.id).lean();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user has access to this season's league
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK
    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    // TODO: Add StudioOwner membership check for non-commissioners
    if (!isOwner && !isComm) {
      return sendErrorResponse(res, HttpStatus.FORBIDDEN, 'Access denied');
    }

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, season);
  } catch (err) {
    console.error('Error fetching season:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch season'
    );
  }
}

/**
 * List seasons for a league
 * GET /api/leagues/:leagueId/seasons
 */
async function getSeasons(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { leagueId } = req.params;
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Verify user has access to this league
    const league = await LeagueModel.findById(leagueId)
      .select('ownerId commissionerIds')
      .lean();

    // ✅ NOT FOUND CHECK
    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK
    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    // TODO: Add StudioOwner membership check
    if (!isOwner && !isComm) {
      return sendErrorResponse(res, HttpStatus.FORBIDDEN, 'Access denied');
    }

    const query = { leagueId };
    const sortSpec: Record<string, 1 | -1> = { startDate: -1, _id: -1 };

    const [items, total] = await Promise.all([
      SeasonModel.find(query).sort(sortSpec).skip(skip).limit(limit).lean(),
      SeasonModel.countDocuments(query),
    ]);

    // ✅ PAGINATED RESPONSE
    return sendPaginatedResponse(res, items, { page, limit, total });
  } catch (err) {
    console.error('Error fetching seasons:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch seasons'
    );
  }
}

/**
 * Update season
 * PATCH /api/seasons/:id
 */
async function updateSeason(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const season = await SeasonModel.findById(req.params.id);

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user can update (owner or commissioner)
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK
    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    if (!isOwner && !isComm) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'Only league owners or commissioners can update seasons'
      );
    }

    const { label, startDate, endDate, weekCount } = req.body;

    if (label !== undefined) season.label = label;
    if (startDate !== undefined) season.startDate = new Date(startDate);
    if (endDate !== undefined) season.endDate = new Date(endDate);
    if (weekCount !== undefined) season.weekCount = weekCount;

    await season.save();

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, season, 'Season updated successfully');
  } catch (err) {
    console.error('Error updating season:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update season'
    );
  }
}

/**
 * Delete season
 * DELETE /api/seasons/:id
 */
async function deleteSeason(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const season = await SeasonModel.findById(req.params.id);

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user can delete (owner only, not commissioners)
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId')
      .lean();

    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK (owner only)
    if (String(league.ownerId) !== userId) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'Only league owner can delete seasons'
      );
    }

    await season.deleteOne();

    // ✅ NO CONTENT RESPONSE (204)
    return res.status(HttpStatus.NO_CONTENT).send();
  } catch (err) {
    console.error('Error deleting season:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to delete season'
    );
  }
}

const seasonController = {
  createSeason,
  getSeason,
  getSeasons,
  updateSeason,
  deleteSeason,
};

export default seasonController;
