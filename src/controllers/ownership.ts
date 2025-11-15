// src/controllers/ownership.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import MovieOwnershipModel from '../models/MovieOwnership.js';
import SeasonModel from '../models/Season.js';
import LeagueModel from '../models/League.js';
import StudioModel from '../models/Studio.js';
import StudioOwnerModel from '../models/StudioOwner.js';
import MovieModel from '../models/Movie.js';
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
 * Create movie ownership (acquire movie for studio)
 * POST /api/ownership
 */
async function createOwnership(req: Request, res: Response) {
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

    const { leagueId, seasonId, studioId, movieId, purchasePrice, acquiredAt } =
      req.body;

    // Verify season exists and belongs to league
    const season = await SeasonModel.findOne({
      _id: seasonId,
      leagueId,
    }).lean();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(
        res,
        HttpStatus.NOT_FOUND,
        'Season not found in league'
      );
    }

    // Verify studio exists and belongs to league
    const studio = await StudioModel.findOne({
      _id: studioId,
      leagueId,
    }).lean();

    if (!studio) {
      return sendErrorResponse(
        res,
        HttpStatus.NOT_FOUND,
        'Studio not found in league'
      );
    }

    // ✅ AUTHORIZATION CHECK
    // Verify user owns or manages this studio
    const studioMembership = await StudioOwnerModel.findOne({
      studioId,
      userId,
    }).lean();

    if (!studioMembership) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'You do not have permission to manage this studio'
      );
    }

    // Verify movie exists
    const movie = await MovieModel.findById(movieId).lean();
    if (!movie) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Movie not found');
    }

    // ✅ CONFLICT CHECK
    // Check if movie is already owned in this season
    const existing = await MovieOwnershipModel.findOne({
      seasonId,
      movieId,
    }).lean();

    if (existing) {
      return sendErrorResponse(
        res,
        HttpStatus.CONFLICT,
        'Movie is already owned by a studio in this season'
      );
    }

    const ownership = await MovieOwnershipModel.create({
      leagueId,
      seasonId,
      studioId,
      movieId,
      purchasePrice,
      acquiredAt: new Date(acquiredAt),
      refundApplied: false,
    });

    // ✅ CREATED RESPONSE (201)
    return res
      .status(HttpStatus.CREATED)
      .json(
        successResponse(ownership, undefined, 'Movie acquired successfully')
      );
  } catch (err) {
    console.error('Error creating ownership:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create ownership'
    );
  }
}

/**
 * Get ownerships by season
 * GET /api/ownership/by-season/:seasonId
 */
async function getOwnershipsBySeason(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { seasonId } = req.params;
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Verify season exists
    const season = await SeasonModel.findById(seasonId).lean();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user has access to this league
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

    // TODO: Add StudioOwner membership check
    if (!isOwner && !isComm) {
      return sendErrorResponse(res, HttpStatus.FORBIDDEN, 'Access denied');
    }

    const query = { seasonId };
    const sortSpec: Record<string, 1 | -1> = { acquiredAt: -1, _id: -1 };

    const [items, total] = await Promise.all([
      MovieOwnershipModel.find(query)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .lean(),
      MovieOwnershipModel.countDocuments(query),
    ]);

    // ✅ PAGINATED RESPONSE
    return sendPaginatedResponse(res, items, { page, limit, total });
  } catch (err) {
    console.error('Error fetching ownerships by season:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch ownerships'
    );
  }
}

/**
 * Get ownerships by studio
 * GET /api/ownership/by-studio/:studioId
 */
async function getOwnershipsByStudio(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { studioId } = req.params;
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Verify studio exists
    const studio = await StudioModel.findById(studioId).lean();

    // ✅ NOT FOUND CHECK
    if (!studio) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Studio not found');
    }

    // Verify user has access to this league
    const league = await LeagueModel.findById(studio.leagueId)
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

    // Check if user is studio member
    const isMember = await StudioOwnerModel.exists({ studioId, userId });

    if (!isOwner && !isComm && !isMember) {
      return sendErrorResponse(res, HttpStatus.FORBIDDEN, 'Access denied');
    }

    const query = { studioId };
    const sortSpec: Record<string, 1 | -1> = { acquiredAt: -1, _id: -1 };

    const [items, total] = await Promise.all([
      MovieOwnershipModel.find(query)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .lean(),
      MovieOwnershipModel.countDocuments(query),
    ]);

    // ✅ PAGINATED RESPONSE
    return sendPaginatedResponse(res, items, { page, limit, total });
  } catch (err) {
    console.error('Error fetching ownerships by studio:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch ownerships'
    );
  }
}

/**
 * Retire movie ownership (sell/drop movie)
 * PATCH /api/ownership/:id/retire
 */
async function retireOwnership(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const ownership = await MovieOwnershipModel.findById(req.params.id);

    // ✅ NOT FOUND CHECK
    if (!ownership) {
      return sendErrorResponse(
        res,
        HttpStatus.NOT_FOUND,
        'Ownership not found'
      );
    }

    // ✅ CONFLICT CHECK
    if (ownership.retiredAt) {
      return sendErrorResponse(
        res,
        HttpStatus.CONFLICT,
        'Ownership already retired'
      );
    }

    // ✅ AUTHORIZATION CHECK
    // Verify user owns or manages this studio
    const studioMembership = await StudioOwnerModel.findOne({
      studioId: ownership.studioId,
      userId,
    }).lean();

    if (!studioMembership) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'You do not have permission to manage this studio'
      );
    }

    ownership.retiredAt = new Date();
    await ownership.save();

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(
      res,
      ownership,
      'Movie ownership retired successfully'
    );
  } catch (err) {
    console.error('Error retiring ownership:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retire ownership'
    );
  }
}

const ownershipController = {
  createOwnership,
  getOwnershipsBySeason,
  getOwnershipsByStudio,
  retireOwnership,
};

export default ownershipController;
