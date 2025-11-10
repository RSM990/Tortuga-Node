import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import isAuth from '../middleware/is-auth.js';
import requireCommissioner from '../middleware/require-commissioner.js';
import Studio, { StudioDoc } from '../models/Studio.js';
import StudioOwner from '../models/StudioOwner.js';
import * as StudiosController from '../controllers/studios.js';

const router = Router();

// ---------- NEW GET endpoints ----------
router.get('/:idOrSlug', isAuth, StudiosController.getStudio);
router.get('/:idOrSlug/movies', isAuth, StudiosController.getStudioMovies);
router.get('/:idOrSlug/awards', isAuth, StudiosController.getStudioAwards);

// POST /studios  (commissioner/owner can create; creator becomes owner of the studio)
router.post(
  '/',
  isAuth,
  requireCommissioner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leagueId, name } = req.body as { leagueId: string; name: string };
      const userId = (req as any).userId as string;

      const studio = await Studio.create({ leagueId, name });

      // IMPORTANT: enforce "one studio per user per league" via StudioOwner with leagueId
      await StudioOwner.create({
        leagueId,
        studioId: studio._id,
        userId,
        roleInStudio: 'owner',
      });

      res.status(201).json(studio);
    } catch (e: any) {
      if (e?.code === 11000) {
        return res.status(409).json({
          message: 'Duplicate studio or membership constraint violated',
          detail: e.keyValue,
        });
      }
      next(e);
    }
  }
);

// POST /studios/:studioId/members   (commissioner/owner adds a user as owner/manager)
router.post('/:studioId/members', isAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId as string;
    const { studioId } = req.params;
    const { memberUserId, roleInStudio } = req.body as {
      memberUserId: string;
      roleInStudio?: 'owner' | 'manager';
    };

    const studio = await Studio.findById(studioId).lean<StudioDoc>();
    if (!studio) return res.status(404).json({ message: 'Studio not found' });

    // permission: league owner/commissioner OR current studio owner/manager
    const isCommOrOwner = await (async () => {
      // quick inline check using the same guard logic
      const requireComm = (
        await import('../middleware/require-commissioner.js')
      ).default;
      // synthesize leagueId in req for the guard
      (req as any).body = {
        ...(req.body || {}),
        leagueId: String(studio.leagueId),
      };
      let allowed = false;
      await new Promise<void>((resolve) =>
        requireComm(req as any, res as any, () => {
          allowed = true;
          resolve();
        })
      );
      if (allowed) return true;

      // fallback: studio role check
      const membership = await StudioOwner.findOne({ studioId, userId }).lean();
      return !!membership;
    })();

    if (!isCommOrOwner)
      return res.status(403).json({ message: 'Insufficient permissions' });

    const doc = await StudioOwner.create({
      leagueId: studio.leagueId, // denormalized
      studioId,
      userId: memberUserId,
      roleInStudio: roleInStudio ?? 'manager',
    });

    res.status(201).json(doc);
  } catch (e: any) {
    if (e?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'User already belongs to a studio in this league' });
    }
    next(e);
  }
});

// GET /studios/by-league/:leagueId
router.get('/by-league/:leagueId', isAuth, async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const studios = await Studio.find({ leagueId }).lean();
    res.json(studios);
  } catch (e) {
    next(e);
  }
});

export default router;
