// src/controllers/dev.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import MovieWeeklyRevenueModel from '../models/MovieWeeklyRevenue.js';
import {
  HttpStatus,
  sendErrorResponse,
  successResponse,
} from '../utils/response.js';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Upsert weekly revenue for a movie (DEV only)
 * POST /api/dev/revenue/upsert
 */
async function upsertRevenue(req: Request, res: Response) {
  try {
    // ✅ ENVIRONMENT CHECK
    // Only allow in development
    if (!isDevelopment) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Not found');
    }

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

    // ✅ CREATED RESPONSE (201)
    return res
      .status(HttpStatus.CREATED)
      .json(
        successResponse(
          { revenue: doc },
          undefined,
          'Revenue upserted successfully'
        )
      );
  } catch (err) {
    console.error('Error upserting revenue:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to upsert revenue'
    );
  }
}

const devController = {
  upsertRevenue,
};

export default devController;
