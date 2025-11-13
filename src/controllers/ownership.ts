// src/controllers/ownership.ts
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import MovieOwnershipModel from '../models/MovieOwnership.js';
import SeasonModel from '../models/Season.js';
import LeagueModel from '../models/League.js';
import StudioModel from '../models/Studio.js';
import StudioOwnerModel from '../models/StudioOwner.js';
import MovieModel from '../models/Movie.js';
import { paginatedResponse, parsePaginationParams } from '../utils/response.js';

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

/**
 * Create movie ownership (acquire movie for studio)
 * POST /api/ownership
 */
async function createOwnership(
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

    const { leagueId, seasonId, studioId, movieId, purchasePrice, acquiredAt } =
      req.body;

    // Verify season exists and belongs to league
    const season = await SeasonModel.findOne({
      _id: seasonId,
      leagueId,
    }).lean();

    if (!season) {
      return res.status(404).json({ message: 'Season not found in league' });
    }

    // Verify studio exists and belongs to league
    const studio = await StudioModel.findOne({
      _id: studioId,
      leagueId,
    }).lean();

    if (!studio) {
      return res.status(404).json({ message: 'Studio not found in league' });
    }

    // Verify user owns or manages this studio
    const studioMembership = await StudioOwnerModel.findOne({
      studioId,
      userId,
    }).lean();

    if (!studioMembership) {
      return res.status(403).json({
        message: 'You do not have permission to manage this studio',
      });
    }

    // Verify movie exists
    const movie = await MovieModel.findById(movieId).lean();
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if movie is already owned in this season
    const existing = await MovieOwnershipModel.findOne({
      seasonId,
      movieId,
    }).lean();

    if (existing) {
      return res.status(409).json({
        message: 'Movie is already owned by a studio in this season',
      });
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

    return res.status(201).json(ownership);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get ownerships by season
 * GET /api/ownership/by-season/:seasonId
 */
async function getOwnershipsBySeason(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { seasonId } = req.params;
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Verify season exists
    const season = await SeasonModel.findById(seasonId).lean();
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    // Verify user has access to this league
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    // TODO: Add StudioOwner membership check
    if (!isOwner && !isComm) {
      return res.status(403).json({ message: 'Access denied' });
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

    return res.json(paginatedResponse(items, page, limit, total));
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get ownerships by studio
 * GET /api/ownership/by-studio/:studioId
 */
async function getOwnershipsByStudio(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { studioId } = req.params;
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Verify studio exists
    const studio = await StudioModel.findById(studioId).lean();
    if (!studio) {
      return res.status(404).json({ message: 'Studio not found' });
    }

    // Verify user has access to this league
    const league = await LeagueModel.findById(studio.leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    // Check if user is studio member
    const isMember = await StudioOwnerModel.exists({ studioId, userId });

    if (!isOwner && !isComm && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
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

    return res.json(paginatedResponse(items, page, limit, total));
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Retire movie ownership (sell/drop movie)
 * PATCH /api/ownership/:id/retire
 */
async function retireOwnership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const ownership = await MovieOwnershipModel.findById(req.params.id);
    if (!ownership) {
      return res.status(404).json({ message: 'Ownership not found' });
    }

    if (ownership.retiredAt) {
      return res.status(400).json({ message: 'Ownership already retired' });
    }

    // Verify user owns or manages this studio
    const studioMembership = await StudioOwnerModel.findOne({
      studioId: ownership.studioId,
      userId,
    }).lean();

    if (!studioMembership) {
      return res.status(403).json({
        message: 'You do not have permission to manage this studio',
      });
    }

    ownership.retiredAt = new Date();
    await ownership.save();

    return res.json(ownership);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

const ownershipController = {
  createOwnership,
  getOwnershipsBySeason,
  getOwnershipsByStudio,
  retireOwnership,
};

export default ownershipController;
