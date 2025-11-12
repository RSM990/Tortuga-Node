// backend/src/middleware/require-league-member.ts
import type { Request, Response, NextFunction } from 'express';
import League from '../models/League.js';

/**
 * Middleware to verify user is a member of the specified league
 * Requires isAuth to run first (sets req.userId)
 *
 * Checks if user is:
 * - League owner
 * - League commissioner
 * - League member (if your League model has a members array)
 */
const requireLeagueMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { leagueId } = req.params;
    const userId = (req as any).userId; // Set by isAuth middleware

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!leagueId) {
      return res.status(400).json({ message: 'League ID is required' });
    }

    // Check if user has access to this league
    // Adjust this query based on your League model structure
    const league = await League.findOne({
      _id: leagueId,
      $or: [
        { ownerId: userId }, // User is owner
        { commissionerIds: userId }, // User is commissioner
        { 'members.userId': userId }, // User is member (if you have members array)
        { 'members.user': userId }, // Alternative member structure
        // Add more conditions based on your schema
      ],
    });

    if (!league) {
      return res.status(403).json({
        message: 'Access denied. You are not a member of this league.',
      });
    }

    // Optional: attach league to request for use in controller
    (req as any).league = league;

    next();
  } catch (err) {
    console.error('requireLeagueMember error:', err);
    next(err);
  }
};

export default requireLeagueMember;
