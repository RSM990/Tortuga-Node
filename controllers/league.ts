// src/controllers/league.ts
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import League from '../models/League.js';
import User from '../models/User.js';

// If you typed req.userId via src/types/express/index.d.ts, this will be present.
const getReqUserId = (req: Request) =>
  (req as any).userId as string | undefined;

async function createLeague(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Standard 422 with validator details
      return res.status(422).json({
        message: 'Validation failed, entered data is incorrect.',
        data: errors.array(),
      });
    }

    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, startDate, endDate } = req.body as {
      name: string;
      startDate?: string | Date;
      endDate?: string | Date;
    };

    // Create league
    const league = await League.create({
      name,
      startDate,
      endDate,
      createdBy: userId,
    });

    // Attach to user profile (assumes User.leagues is an array of ObjectIds)
    const creator = await User.findById(userId);
    if (!creator) return res.status(404).json({ message: 'Creator not found' });

    (creator.leagues as any[]).push(league._id);
    await creator.save();

    return res.status(201).json({
      message: 'League created successfully!!',
      league,
      creator: {
        _id: creator._id,
        // Adjust to your schema — using first/last if present
        name:
          (creator as any).name ??
          `${(creator as any).firstName ?? ''} ${
            (creator as any).lastName ?? ''
          }`.trim(),
      },
    });
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

export default {
  createLeague,
};
