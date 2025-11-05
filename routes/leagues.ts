import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import isAuth from '../middleware/is-auth.js';
import requireCommissioner from '../middleware/require-commissioner.js';
import League from '../models/League.js';
import User from '../models/User.js';

const router = Router();

const toSlug = (s: string) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// POST /leagues  (owner = current user)
router.post(
  '/',
  isAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const body: any = { ...req.body };
      body.slug = body.slug ? toSlug(body.slug) : toSlug(body.name);
      body.ownerId = userId; // <-- set owner automatically
      body.commissionerIds = body.commissionerIds ?? []; // optional seed

      const exists = await League.findOne({ slug: body.slug }).lean();
      if (exists)
        return res
          .status(409)
          .json({ message: 'League slug already exists. Choose another.' });

      const league = await League.create(body);
      await User.findByIdAndUpdate(userId, {
        $addToSet: { leagues: league._id },
      });
      return res.status(201).json(league);
    } catch (e) {
      next(e);
    }
  }
);

// GET /leagues/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const league = await League.findOne({ slug: req.params.slug });
    if (!league) return res.status(404).json({ message: 'Not found' });
    res.json(league);
  } catch (e) {
    next(e);
  }
});

// PATCH /leagues/:id  (commissioner/owner only)
router.patch('/:id', isAuth, async (req, res, next) => {
  try {
    const league = await League.findById(req.params.id);
    if (!league) return res.status(404).json({ message: 'Not found' });

    const userId = (req as any).userId as string;
    const isOwner = String(league.ownerId) === String(userId);
    const isComm = league.commissionerIds?.some(
      (id: any) => String(id) === String(userId)
    );
    if (!isOwner && !isComm)
      return res
        .status(403)
        .json({ message: 'Commissioner or owner role required' });

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
});

// PATCH /leagues/:id/commissioners  (owner only)
router.patch('/:id/commissioners', isAuth, async (req, res, next) => {
  try {
    const league = await League.findById(req.params.id);
    if (!league) return res.status(404).json({ message: 'Not found' });

    const userId = (req as any).userId as string;
    const isOwner = String(league.ownerId) === String(userId);
    if (!isOwner)
      return res.status(403).json({ message: 'Owner role required' });

    const { commissionerIds } = req.body as { commissionerIds: string[] };
    const saved = await League.findByIdAndUpdate(
      req.params.id,
      { $set: { commissionerIds: commissionerIds ?? [] } },
      { new: true }
    );
    res.json(saved);
  } catch (e) {
    next(e);
  }
});

export default router;
