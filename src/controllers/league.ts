// src/controllers/league.ts
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Types } from 'mongoose';
import LeagueModel from '../models/League.js';
import StudioModel from '../models/Studio.js';
import StudioOwnerModel from '../models/StudioOwner.js';
import UserModel from '../models/User.js';
import {
  nextAvailableLeagueSlugAgg,
  assignLeagueSlugAtomic,
} from '../services/slugService.js';
import { toSlug } from '../utils/slug.js';
import { paginatedResponse, parsePaginationParams } from '../utils/response.js';

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
async function getLeagues(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { page, limit, skip } = parsePaginationParams(req.query);
    const q = String(req.query.q ?? '').trim();
    const visibility = String(req.query.visibility ?? '').trim();
    const sort = parseSort(String(req.query.sort ?? ''));

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

    const [data, total] = await Promise.all([
      LeagueModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      LeagueModel.countDocuments(filter),
    ]);

    return res.json(paginatedResponse(data, page, limit, total));
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Create a new league
 * POST /api/leagues
 */
async function createLeague(req: Request, res: Response, next: NextFunction) {
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

    const body: any = { ...req.body };
    const baseName = body.slug ? body.slug : body.name;

    const created = await assignLeagueSlugAtomic(
      baseName,
      async (uniqueSlug) => {
        body.slug = uniqueSlug;
        body.ownerId = userId;
        body.commissionerIds = body.commissionerIds ?? [];
        const league = await LeagueModel.create(body);
        // Note: User-League relationship tracked via StudioOwner, not User.leagues
        return league;
      }
    );

    return res.status(201).json(created);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get league by ID or slug
 * GET /api/leagues/:idOrSlug
 */
async function getLeague(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
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

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    return res.json(league);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Update league
 * PATCH /api/leagues/:id
 */
async function updateLeague(req: Request, res: Response, next: NextFunction) {
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

    const league = await LeagueModel.findById(req.params.id);
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    const isOwner = String(league.ownerId) === userId;
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === userId
    );

    if (!isOwner && !isComm) {
      return res.status(403).json({
        message: 'Commissioner or owner role required',
      });
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
        if (exists) {
          return res.status(409).json({
            message: 'League slug already exists. Choose another.',
          });
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

    return res.json(saved);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Delete league
 * DELETE /api/leagues/:id
 */
async function deleteLeague(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const league = await LeagueModel.findById(req.params.id);
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    // Only owner can delete
    if (String(league.ownerId) !== userId) {
      return res.status(403).json({
        message: 'Only league owner can delete the league',
      });
    }

    await league.deleteOne();

    return res.status(204).send();
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get league members
 * GET /api/leagues/:idOrSlug/members
 */
async function getLeagueMembers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
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

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
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

    return res.json(members);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get league standings
 * GET /api/leagues/:idOrSlug/standings
 */
async function getLeagueStandings(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
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

    if (!league) {
      return res.status(404).json({ message: 'League not found' });
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

    return res.json(standings);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Check slug availability
 * GET /api/leagues/slug/check?name=<nameOrSlug>
 */
async function checkSlugAvailability(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const raw = String(req.query.name || req.query.slug || '');
    const result = await nextAvailableLeagueSlugAgg(raw);
    return res.json(result);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
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
