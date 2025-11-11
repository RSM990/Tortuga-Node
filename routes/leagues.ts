import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import isAuth from '../middleware/is-auth.js';
import requireCommissioner from '../middleware/require-commissioner.js'; // (unused here but kept if you need later)
import League, { LeagueDoc } from '../models/League.js';
import Studio from '../models/Studio.js';
import StudioOwner from '../models/StudioOwner.js';
import User from '../models/User.js';
import {
  nextAvailableLeagueSlugAgg,
  assignLeagueSlugAtomic,
} from '../services/slugService.js';
import { toSlug } from '../utils/slug.js';

const router = Router();
const { Types } = mongoose;

// ---------- HELPERS ----------

const allowedVis = new Set(['private', 'unlisted', 'public']);
const allowedSortKeys = new Set(['createdAt', 'updatedAt', 'name', 'slug']);

function parseIntOr<T extends number>(val: any, fallback: T): T {
  const n = Number.parseInt(String(val), 10);
  // @ts-ignore
  return Number.isFinite(n) && n > 0 ? (n as T) : fallback;
}

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
 * Distinct leagueIds where the user has a studio (membership).
 */
async function memberLeagueIdsFor(userId: string): Promise<Types.ObjectId[]> {
  const ids = await StudioOwner.find({ userId }).distinct('leagueId').lean();
  // Normalize to ObjectIds
  return ids
    .filter(Boolean)
    .map((x: any) => (Types.ObjectId.isValid(x) ? new Types.ObjectId(x) : x));
}

/**
 * Builds the $or membership clause for queries:
 * - owner
 * - commissioner
 * - member via StudioOwner
 * - (optional) leagues array on User (if you keep that relationship)
 */
function membershipOrClause(userId: string, memberLeagueIds: Types.ObjectId[]) {
  const or: any[] = [
    { ownerId: userId },
    { commissionerIds: userId },
    { _id: { $in: memberLeagueIds } },
  ];
  return { $or: or };
}

// ---------- ROUTES ----------

// GET /leagues  → list with pagination & filters
// NOW: auth required; returns only leagues user belongs to
// Supports: ?page=1&limit=12&q=&visibility=private|unlisted|public&sort=createdAt_desc
router.get(
  '/',
  isAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const page = parseIntOr(req.query.page, 1);
      const limit = parseIntOr(req.query.limit, 12);
      const q = String(req.query.q ?? '').trim();
      const visibility = String(req.query.visibility ?? '').trim();
      const sort = parseSort(String(req.query.sort ?? ''));

      const memberIds = await memberLeagueIdsFor(userId);

      const filter: any = membershipOrClause(userId, memberIds);

      // Basic search on name or slug
      if (q) {
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$and = (filter.$and || []).concat([
          { $or: [{ name: regex }, { slug: regex }] },
        ]);
      }

      // Optional visibility filter (still scoped to membership)
      if (visibility && allowedVis.has(visibility)) {
        filter.$and = (filter.$and || []).concat([{ visibility }]);
      }

      const [data, total] = await Promise.all([
        League.find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        League.countDocuments(filter),
      ]);

      return res.json({ data, page, limit, total });
    } catch (e) {
      next(e);
    }
  }
);

// POST /leagues  (owner = current user)
router.post('/', isAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId as string;
    const body: any = { ...req.body };
    const baseName = body.slug ? body.slug : body.name;

    const created = await assignLeagueSlugAtomic(
      baseName,
      async (uniqueSlug) => {
        body.slug = uniqueSlug;
        body.ownerId = userId;
        body.commissionerIds = body.commissionerIds ?? [];
        const league = await League.create(body);
        await User.findByIdAndUpdate(userId, {
          $addToSet: { leagues: league._id },
        });
        return league;
      }
    );

    return res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// GET /leagues/:idOrSlug  → details
// NOW: auth required; must be a member/owner/commissioner
router.get(
  '/:idOrSlug',
  isAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { idOrSlug } = req.params;
      const by = isObjectIdLike(idOrSlug)
        ? { _id: idOrSlug }
        : { slug: idOrSlug };

      const memberIds = await memberLeagueIdsFor(userId);
      const league = await League.findOne({
        ...by,
        ...membershipOrClause(userId, memberIds),
      }).lean();

      if (!league) return res.status(404).json({ message: 'Not found' });
      res.json(league);
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /leagues/:id  (commissioner/owner only)
router.patch(
  '/:id',
  isAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const league = await League.findById(req.params.id);
      if (!league) return res.status(404).json({ message: 'Not found' });

      const userId = (req as any).userId as string;
      const isOwner = String(league.ownerId) === String(userId);
      const isComm = league.commissionerIds?.some(
        (id: any) => String(id) === String(userId)
      );
      if (!isOwner && !isComm) {
        return res
          .status(403)
          .json({ message: 'Commissioner or owner role required' });
      }

      const { slug, ownerId, commissionerIds, ...rest } = req.body ?? {};
      const update: any = { ...rest };

      if (slug !== undefined) update.slug = toSlug(slug);
      if (update.slug) {
        const exists = await League.findOne({
          slug: update.slug,
          _id: { $ne: req.params.id },
        }).lean();
        if (exists)
          return res
            .status(409)
            .json({ message: 'League slug already exists. Choose another.' });
      }

      // Only owner can change ownerId or commissioner list
      if (isOwner) {
        if (ownerId !== undefined) update.ownerId = ownerId;
        if (Array.isArray(commissionerIds))
          update.commissionerIds = commissionerIds;
      }

      const saved = await League.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      });
      res.json(saved);
    } catch (e) {
      next(e);
    }
  }
);

// GET /leagues/:idOrSlug/members  → members listing
// NOW: auth required + membership check
router.get('/:idOrSlug/members', isAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId as string;
    const { idOrSlug } = req.params;
    const by = isObjectIdLike(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug };

    // authorize
    const memberIds = await memberLeagueIdsFor(userId);
    const league = await League.findOne({
      ...by,
      ...membershipOrClause(userId, memberIds),
    }).lean();
    if (!league) return res.status(404).json({ message: 'Not found' });

    // Join StudioOwner -> User + Studio
    const links = await StudioOwner.find({ leagueId: league._id }).lean();
    const userIds = links.map((l) => l.userId);
    const studioIds = links.map((l) => l.studioId);

    const [users, studios] = await Promise.all([
      User.find({ _id: { $in: userIds } })
        .select('_id displayName name username email')
        .lean(),
      Studio.find({ _id: { $in: studioIds } })
        .select('_id name')
        .lean(),
    ]);

    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const studioMap = new Map(studios.map((s) => [String(s._id), s]));

    const members = links.map((l) => {
      const u = userMap.get(String(l.userId)) || { _id: l.userId };
      const studio = studioMap.get(String(l.studioId));
      const displayName =
        (u as any).name ||
        (u as any).displayName ||
        (u as any).username ||
        (u as any).email ||
        'Unknown';

      return {
        user: { _id: String(l.userId), displayName },
        studioId: String(l.studioId),
        studioName: studio?.name ?? 'Unknown Studio',
        roleInStudio: (l as any).roleInStudio,
      };
    });

    res.json(members);
  } catch (e) {
    next(e);
  }
});

// GET /leagues/:idOrSlug/standings
// NOW: auth required + membership check
router.get('/:idOrSlug/standings', isAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId as string;
    const { idOrSlug } = req.params;
    const by = isObjectIdLike(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug };

    // authorize
    const memberIds = await memberLeagueIdsFor(userId);
    const league = await League.findOne({
      ...by,
      ...membershipOrClause(userId, memberIds),
    }).lean<LeagueDoc>();
    if (!league) return res.status(404).json({ message: 'Not found' });

    // TODO: replace with real aggregation of points per studio
    const studios = await Studio.find({ leagueId: league._id }).lean();

    const rows = studios.map((s) => ({
      studioId: String(s._id),
      studioName: s.name,
      points: 0,
    }));

    rows.sort((a, b) => b.points - a.points);
    let rank = 1;
    const standings = rows.map((r) => ({ ...r, rank: rank++ }));

    res.json(standings);
  } catch (e) {
    next(e);
  }
});

// GET /leagues/slug/check?name=<nameOrSlug>  (public)
router.get('/slug/check', async (req, res, next) => {
  try {
    const raw = String(req.query.name || req.query.slug || '');
    const result = await nextAvailableLeagueSlugAgg(raw);
    res.json(result); // { base, suggested, count, isAvailable }
  } catch (e) {
    next(e);
  }
});

export default router;
