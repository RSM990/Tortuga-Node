import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import MovieWeeklyRevenue from '../models/MovieWeeklyRevenue.js';

const router = Router();

/**
 * Upsert weekly revenue for a movie (DEV helper)
 * POST /dev/revenue/upsert
 * Body: { movieId, weekStart, weekEnd, domesticGross?, worldwideGross? }
 */
router.post(
  '/dev/revenue/upsert',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        movieId,
        weekStart,
        weekEnd,
        domesticGross = 0,
        worldwideGross = 0,
      } = req.body ?? {};

      if (!movieId || !weekStart || !weekEnd) {
        return res
          .status(400)
          .json({ message: 'movieId, weekStart, and weekEnd are required' });
      }

      const ws = new Date(weekStart);
      const we = new Date(weekEnd);
      if (Number.isNaN(ws.getTime()) || Number.isNaN(we.getTime())) {
        return res
          .status(400)
          .json({ message: 'weekStart and weekEnd must be valid dates' });
      }

      const doc = await MovieWeeklyRevenue.findOneAndUpdate(
        { movieId, weekStart: ws },
        {
          $set: {
            weekEnd: we,
            domesticGross: Number(domesticGross) || 0,
            worldwideGross: Number(worldwideGross) || 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({ ok: true, revenue: doc });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
