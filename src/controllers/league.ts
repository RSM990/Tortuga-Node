// src/controllers/league.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Types } from 'mongoose';
import LeagueModel from '../models/League.js';
import StudioModel from '../models/Studio.js';
import StudioOwnerModel from '../models/StudioOwner.js';
import UserModel from '../models/User.js';
import logger from '../config/logger.js';
import {
  nextAvailableLeagueSlugAgg,
  assignLeagueSlugAtomic,
} from '../services/slugService.js';
import { toSlug } from '../utils/slug.js';
import {
  HttpStatus,
  parsePaginationParams,
  sendPaginatedResponse,
  sendSuccessResponse,
  sendErrorResponse,
  successResponse, // For custom status codes like 201
} from '../utils/response.js';

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

const allowedVis = new Set(['private', 'unlisted', 'public']);
const allowedSortKeys = new Set(['createdAt', 'updatedAt', 'name', 'slug']);

function parseSort(sort?: string): Record<string, 1 | -1> {
  const raw = (sort || '').trim();
  if (!raw) return { createdAt: -1 };
  const [key, dirRaw] = raw.split('_');
  if (!allowedSortKeys.has(key)) return { createdAt: -1 };
  const dir = (dirRaw || 'desc').toLowerCase();
  return { [key]: dir === 'asc' ? 1 : -1 } as Record<string, 1 | -1>;
}

function isObjectIdLike(s: string) {
  return Types.ObjectId.isValid(s);
}

/**
 * Get distinct leagueIds where the user has a studio (membership)
 */
async function memberLeagueIdsFor(userId: string): Promise<Types.ObjectId[]> {
  const ids = await StudioOwnerModel.find({ userId })
    .distinct('leagueId')
    .lean();
  return ids
    .filter(Boolean)
    .map((x: any) => (Types.ObjectId.isValid(x) ? new Types.ObjectId(x) : x));
}

/**
 * Build membership clause for queries
 */
function membershipOrClause(userId: string, memberLeagueIds: Types.ObjectId[]) {
  return {
    $or: [
      { ownerId: userId },
      { commissionerIds: userId },
      { _id: { $in: memberLeagueIds } },
    ],
  };
}

/**
 * List leagues user belongs to
 * GET /api/leagues
 */
async function getLeagues(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    // ✅ PAGINATION
    const { page, limit, skip } = parsePaginationParams(req.query);
    const q = String(req.query.q ?? '').trim();
    const visibility = String(req.query.visibility ?? '').trim();
    const sort = parseSort(String(req.query.sort ?? ''));

    // Build filter
    const memberIds = await memberLeagueIdsFor(userId);
    const filter: any = membershipOrClause(userId, memberIds);

    // Search filter
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = (filter.$and || []).concat([
        { $or: [{ name: regex }, { slug: regex }] },
      ]);
    }

    // Visibility filter
    if (visibility && allowedVis.has(visibility)) {
      filter.$and = (filter.$and || []).concat([{ visibility }]);
    }

    // Execute query
    const [data, total] = await Promise.all([
      LeagueModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      LeagueModel.countDocuments(filter),
    ]);

    // ✅ STANDARDIZED RESPONSE
    return sendPaginatedResponse(res, data, { page, limit, total });
  } catch (err) {
    logger.error('Failed to fetch leagues', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      userId: getReqUserId(req),
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch leagues'
    );
  }
}

/**
 * Create a new league
 * POST /api/leagues
 */
async function createLeague(req: Request, res: Response) {
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

    const body: any = { ...req.body };
    const baseName = body.slug ? body.slug : body.name;

    const created = await assignLeagueSlugAtomic(
      baseName,
      async (uniqueSlug) => {
        body.slug = uniqueSlug;
        body.ownerId = userId;
        body.commissionerIds = body.commissionerIds ?? [];
        const league = await LeagueModel.create(body);
        return league;
      }
    );

    // ✅ CREATED RESPONSE (201)
    return res
      .status(HttpStatus.CREATED)
      .json(successResponse(created, undefined, 'League created successfully'));
  } catch (err) {
    logger.error('Failed to create league', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      userId: getReqUserId(req),
      leagueName: req.body.name,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create league'
    );
  }
}

/**
 * Get league by ID or slug
 * GET /api/leagues/:idOrSlug
 */
async function getLeague(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { idOrSlug } = req.params;
    const by = isObjectIdLike(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug };

    const memberIds = await memberLeagueIdsFor(userId);
    const league = await LeagueModel.findOne({
      ...by,
      ...membershipOrClause(userId, memberIds),
    }).lean();

    // ✅ NOT FOUND CHECK
    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ STANDARDIZED RESPONSE
    return sendSuccessResponse(res, league);
  } catch (err) {
    logger.error('Error fetching league', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch league'
    );
  }
}

/**
 * Update league
 * PATCH /api/leagues/:id
 */
async function updateLeague(req: Request, res: Response) {
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

    const league = await LeagueModel.findById(req.params.id);

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
        'Commissioner or owner role required'
      );
    }

    const { slug, ownerId, commissionerIds, ...rest } = req.body ?? {};
    const update: any = { ...rest };

    // Handle slug update
    if (slug !== undefined) {
      update.slug = toSlug(slug);
      if (update.slug) {
        const exists = await LeagueModel.findOne({
          slug: update.slug,
          _id: { $ne: req.params.id },
        }).lean();

        // ✅ CONFLICT CHECK
        if (exists) {
          return sendErrorResponse(
            res,
            HttpStatus.CONFLICT,
            'League slug already exists. Choose another.'
          );
        }
      }
    }

    // Only owner can change ownerId or commissioners
    if (isOwner) {
      if (ownerId !== undefined) update.ownerId = ownerId;
      if (Array.isArray(commissionerIds))
        update.commissionerIds = commissionerIds;
    }

    const saved = await LeagueModel.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    // ✅ STANDARDIZED RESPONSE
    return sendSuccessResponse(res, saved, 'League updated successfully');
  } catch (err) {
    logger.error('Error updating league', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update league'
    );
  }
}

/**
 * Delete league
 * DELETE /api/leagues/:id
 */
async function deleteLeague(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const league = await LeagueModel.findById(req.params.id);

    // ✅ NOT FOUND CHECK
    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // ✅ AUTHORIZATION CHECK (only owner can delete)
    if (String(league.ownerId) !== userId) {
      return sendErrorResponse(
        res,
        HttpStatus.FORBIDDEN,
        'Only league owner can delete the league'
      );
    }

    await league.deleteOne();

    // ✅ NO CONTENT RESPONSE (204)
    // Note: 204 responses have no body
    return res.status(HttpStatus.NO_CONTENT).send();
  } catch (err) {
    logger.error('Error deleting league', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to delete league'
    );
  }
}

/**
 * Get league members
 * GET /api/leagues/:idOrSlug/members
 */
async function getLeagueMembers(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { idOrSlug } = req.params;
    const by = isObjectIdLike(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug };

    const memberIds = await memberLeagueIdsFor(userId);
    const league = await LeagueModel.findOne({
      ...by,
      ...membershipOrClause(userId, memberIds),
    }).lean();

    // ✅ NOT FOUND CHECK
    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // Get all studio owners in this league
    const links = await StudioOwnerModel.find({ leagueId: league._id }).lean();
    const userIds = links.map((l) => l.userId);
    const studioIds = links.map((l) => l.studioId);

    const [users, studios] = await Promise.all([
      UserModel.find({ _id: { $in: userIds } })
        .select('_id firstName lastName email')
        .lean(),
      StudioModel.find({ _id: { $in: studioIds } })
        .select('_id name')
        .lean(),
    ]);

    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const studioMap = new Map(studios.map((s) => [String(s._id), s]));

    const members = links.map((l) => {
      const u = userMap.get(String(l.userId)) || { _id: l.userId };
      const studio = studioMap.get(String(l.studioId));
      const displayName =
        `${(u as any).firstName || ''} ${(u as any).lastName || ''}`.trim() ||
        (u as any).email ||
        'Unknown';

      return {
        user: { _id: String(l.userId), displayName },
        studioId: String(l.studioId),
        studioName: studio?.name ?? 'Unknown Studio',
        roleInStudio: (l as any).roleInStudio,
      };
    });

    // ✅ ARRAY RESPONSE (not paginated)
    return sendSuccessResponse(res, members);
  } catch (err) {
    logger.error('Error fetching league members', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch league members'
    );
  }
}

/**
 * Get league standings
 * GET /api/leagues/:idOrSlug/standings
 */
async function getLeagueStandings(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { idOrSlug } = req.params;
    const by = isObjectIdLike(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug };

    const memberIds = await memberLeagueIdsFor(userId);
    const league = await LeagueModel.findOne({
      ...by,
      ...membershipOrClause(userId, memberIds),
    }).lean();

    // ✅ NOT FOUND CHECK
    if (!league) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'League not found');
    }

    // TODO: Replace with real aggregation of points per studio
    const studios = await StudioModel.find({ leagueId: league._id }).lean();

    const rows = studios.map((s) => ({
      studioId: String(s._id),
      studioName: s.name,
      points: 0,
    }));

    rows.sort((a, b) => b.points - a.points);
    let rank = 1;
    const standings = rows.map((r) => ({ ...r, rank: rank++ }));

    // ✅ ARRAY RESPONSE (not paginated)
    return sendSuccessResponse(res, standings);
  } catch (err) {
    logger.error('Error fetching league standings', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch league standings'
    );
  }
}

/**
 * Check slug availability
 * GET /api/leagues/slug/check?name=<nameOrSlug>
 */
async function checkSlugAvailability(req: Request, res: Response) {
  try {
    const raw = String(req.query.name || req.query.slug || '');
    const result = await nextAvailableLeagueSlugAgg(raw);

    // ✅ STANDARDIZED RESPONSE
    return sendSuccessResponse(res, result);
  } catch (err) {
    logger.error('Error checking slug availability', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to check slug availability'
    );
  }
}

const leagueController = {
  getLeagues,
  createLeague,
  getLeague,
  updateLeague,
  deleteLeague,
  getLeagueMembers,
  getLeagueStandings,
  checkSlugAvailability,
};

export default leagueController;
