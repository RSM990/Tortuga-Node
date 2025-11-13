// src/controllers/dev.ts
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import MovieWeeklyRevenueModel from '../models/MovieWeeklyRevenue.js';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Upsert weekly revenue for a movie (DEV only)
 * POST /api/dev/revenue/upsert
 */
async function upsertRevenue(req: Request, res: Response, next: NextFunction) {
  try {
    // Only allow in development
    if (!isDevelopment) {
      return res.status(404).json({ message: 'Not found' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Validation failed',
        data: errors.array(),
      });
    }

    const {
      movieId,
      weekStart,
      weekEnd,
      domesticGross = 0,
      worldwideGross = 0,
    } = req.body;

    const ws = new Date(weekStart);
    const we = new Date(weekEnd);

    const doc = await MovieWeeklyRevenueModel.findOneAndUpdate(
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
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

const devController = {
  upsertRevenue,
};

export default devController;
