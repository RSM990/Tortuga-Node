// src/controllers/compute.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';
import { validationResult } from 'express-validator';
import SeasonModel, { ISeasonDocument } from '../models/Season.js';
import LeagueModel, { ILeagueDocument } from '../models/League.js';
import MovieWeeklyRevenueModel from '../models/MovieWeeklyRevenue.js';
import MovieOwnershipModel from '../models/MovieOwnership.js';
import StudioWeeklyRevenueModel from '../models/StudioWeeklyRevenue.js';
import WeeklyRankingModel from '../models/WeeklyRanking.js';
import {
  HttpStatus,
  sendSuccessResponse,
  sendErrorResponse,
  successResponse,
} from '../utils/response.js';

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

const POINTS_TABLE_OPTION_B = [10, 8, 6, 5, 4, 3, 2, 1];

function computeWeekWindow(start: Date, weekIndex: number) {
  const ws = new Date(start.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
  const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { weekStart: ws, weekEnd: we };
}

/**
 * Compute weekly rankings for a season
 * POST /api/seasons/:id/compute/week/:weekIndex
 */
async function computeWeek(req: Request, res: Response) {
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
    const weekIndex = Number(req.params.weekIndex);

    const season = await SeasonModel.findById(seasonId).lean<ISeasonDocument>();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

    // Verify user is league owner or commissioner
    const league = await LeagueModel.findById(
      season.leagueId
    ).lean<ILeagueDocument>();

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
        'Only league owners or commissioners can compute weeks'
      );
    }

    const { weekStart, weekEnd } = computeWeekWindow(
      new Date(season.startDate),
      weekIndex
    );

    // 1) Get all ownerships for this season
    const ownerships = await MovieOwnershipModel.find({ seasonId }).lean();
    const movieToStudio = new Map<string, { studioId: any }>();
    for (const o of ownerships) {
      movieToStudio.set(String(o.movieId), { studioId: o.studioId });
    }

    // 2) Get movie weekly revenue for this week
    const revenues = await MovieWeeklyRevenueModel.find({
      weekStart: { $gte: weekStart, $lte: weekEnd },
    }).lean();

    // 3) Sum per studio
    const perStudio = new Map<
      string,
      { totalDomestic: number; totalWorldwide: number }
    >();
    for (const r of revenues) {
      const key = String(r.movieId);
      const owner = movieToStudio.get(key);
      if (!owner) continue;
      const sid = String(owner.studioId);
      const agg = perStudio.get(sid) || {
        totalDomestic: 0,
        totalWorldwide: 0,
      };
      agg.totalDomestic += Number(r.domesticGross || 0);
      agg.totalWorldwide += Number(r.worldwideGross || 0);
      perStudio.set(sid, agg);
    }

    // 4) Upsert StudioWeeklyRevenue
    const upserts: any[] = [];
    for (const [studioId, totals] of perStudio.entries()) {
      const doc = await StudioWeeklyRevenueModel.findOneAndUpdate(
        { seasonId, weekIndex, studioId },
        {
          $set: {
            leagueId: season.leagueId,
            weekStart,
            weekEnd,
            totalDomesticGross: totals.totalDomestic,
            totalWorldwideGross: totals.totalWorldwide,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      upserts.push(doc);
    }

    // 5) Build ranking
    const ranked = [...perStudio.entries()]
      .map(([studioId, totals]) => ({
        studioId,
        revenue: totals.totalWorldwide,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Get points table (custom or default)
    const pointsTable =
      league.pointsScheme === 'custom' && league.customPointTable
        ? Array.from(league.customPointTable.values())
        : POINTS_TABLE_OPTION_B;

    const rows = ranked.map((row, i) => ({
      studioId: row.studioId,
      rank: i + 1,
      points: pointsTable[i] ?? 0,
      revenue: row.revenue,
    }));

    // 6) Upsert WeeklyRanking
    const ranking = await WeeklyRankingModel.findOneAndUpdate(
      { seasonId, weekIndex },
      {
        $set: {
          leagueId: season.leagueId,
          rows,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ✅ CREATED RESPONSE (201)
    return res.status(HttpStatus.CREATED).json(
      successResponse(
        {
          window: { weekIndex, weekStart, weekEnd },
          studiosUpdated: upserts.length,
          ranking: ranking.rows,
        },
        undefined,
        'Week computed successfully'
      )
    );
  } catch (err) {
    logger.error('Error computing week', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to compute week'
    );
  }
}

/**
 * Get studio totals for a given week
 * GET /api/seasons/:id/studios/week/:weekIndex
 */
async function getStudioWeeklyTotals(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const seasonId = req.params.id;
    const weekIndex = Number(req.params.weekIndex);

    // ✅ VALIDATION CHECK
    if (!Number.isInteger(weekIndex) || weekIndex < 0) {
      return sendErrorResponse(
        res,
        HttpStatus.BAD_REQUEST,
        'Week index must be a non-negative integer'
      );
    }

    // Verify season exists and user has access
    const season = await SeasonModel.findById(seasonId).lean();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

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

    const docs = await StudioWeeklyRevenueModel.find({
      seasonId,
      weekIndex,
    }).lean();

    // ✅ ARRAY RESPONSE (not paginated)
    return sendSuccessResponse(res, docs);
  } catch (err) {
    logger.error('Error fetching studio weekly totals', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch studio weekly totals'
    );
  }
}

/**
 * Get ranking table for a given week
 * GET /api/seasons/:id/rankings/week/:weekIndex
 */
async function getWeeklyRanking(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const seasonId = req.params.id;
    const weekIndex = Number(req.params.weekIndex);

    // ✅ VALIDATION CHECK
    if (!Number.isInteger(weekIndex) || weekIndex < 0) {
      return sendErrorResponse(
        res,
        HttpStatus.BAD_REQUEST,
        'Week index must be a non-negative integer'
      );
    }

    // Verify season exists and user has access
    const season = await SeasonModel.findById(seasonId).lean();

    // ✅ NOT FOUND CHECK
    if (!season) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Season not found');
    }

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

    const doc = await WeeklyRankingModel.findOne({
      seasonId,
      weekIndex,
    }).lean();

    // ✅ NOT FOUND CHECK
    if (!doc) {
      return sendErrorResponse(
        res,
        HttpStatus.NOT_FOUND,
        'No ranking for that week'
      );
    }

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, doc);
  } catch (err) {
    logger.error('Error fetching weekly ranking', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch weekly ranking'
    );
  }
}

const computeController = {
  computeWeek,
  getStudioWeeklyTotals,
  getWeeklyRanking,
};

export default computeController;
