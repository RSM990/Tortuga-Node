// src/controllers/season.ts
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import SeasonModel from '../models/Season.js';
import LeagueModel from '../models/League.js';
import { paginatedResponse, parsePaginationParams } from '../utils/response.js';

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

/**
 * Create a new season
 * POST /api/seasons
 */
async function createSeason(req: Request, res: Response, next: NextFunction) {
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

    const { leagueId, label, startDate, endDate, weekCount } = req.body;

    // Verify user can create seasons in this league (owner or commissioner)
    const league = await LeagueModel.findById(leagueId)
      .select('ownerId commissionerIds')
      .lean();

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    if (!isOwner && !isComm) {
      return res.status(403).json({
        message: 'Only league owners or commissioners can create seasons',
      });
    }

    const season = await SeasonModel.create({
      leagueId,
      label,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      weekCount,
    });

    return res.status(201).json(season);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get season by ID
 * GET /api/seasons/:id
 */
async function getSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const season = await SeasonModel.findById(req.params.id).lean();
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    // Verify user has access to this season's league
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

    // TODO: Add StudioOwner membership check for non-commissioners
    if (!isOwner && !isComm) {
      return res.status(403).json({
        message: 'Access denied',
      });
    }

    return res.json(season);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * List seasons for a league
 * GET /api/leagues/:leagueId/seasons
 */
async function getSeasons(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { leagueId } = req.params;
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Verify user has access to this league
    const league = await LeagueModel.findById(leagueId)
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

    const query = { leagueId };
    const sortSpec: Record<string, 1 | -1> = { startDate: -1, _id: -1 };

    const [items, total] = await Promise.all([
      SeasonModel.find(query).sort(sortSpec).skip(skip).limit(limit).lean(),
      SeasonModel.countDocuments(query),
    ]);

    return res.json(paginatedResponse(items, page, limit, total));
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Update season
 * PATCH /api/seasons/:id
 */
async function updateSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const season = await SeasonModel.findById(req.params.id);
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    // Verify user can update (owner or commissioner)
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

    if (!isOwner && !isComm) {
      return res.status(403).json({
        message: 'Only league owners or commissioners can update seasons',
      });
    }

    const { label, startDate, endDate, weekCount } = req.body;

    if (label !== undefined) season.label = label;
    if (startDate !== undefined) season.startDate = new Date(startDate);
    if (endDate !== undefined) season.endDate = new Date(endDate);
    if (weekCount !== undefined) season.weekCount = weekCount;

    await season.save();

    return res.json(season);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Delete season
 * DELETE /api/seasons/:id
 */
async function deleteSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const season = await SeasonModel.findById(req.params.id);
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    // Verify user can delete (owner only, not commissioners)
    const league = await LeagueModel.findById(season.leagueId)
      .select('ownerId')
      .lean();

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    if (String(league.ownerId) !== userId) {
      return res.status(403).json({
        message: 'Only league owner can delete seasons',
      });
    }

    await season.deleteOne();

    return res.status(204).send();
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
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
