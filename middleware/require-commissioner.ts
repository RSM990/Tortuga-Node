// src/middleware/require-commissioner.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import League, { LeagueDoc } from '../models/League.js';

function pickLeagueId(req: Request): string | undefined {
  return (
    (req.body?.leagueId as string) ||
    (req.params?.leagueId as string) ||
    (req.query?.leagueId as string)
  );
}

const requireCommissioner: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const leagueId = pickLeagueId(req);
  const userId = (req as any).userId as string | undefined;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!leagueId)
    return res.status(400).json({ message: 'leagueId is required' });

  const league = await League.findById(leagueId)
    .select('ownerId commissionerIds')
    .lean<LeagueDoc>();
  if (!league) return res.status(404).json({ message: 'League not found' });

  const isOwner = String(league.ownerId) === String(userId);
  const isComm =
    Array.isArray(league.commissionerIds) &&
    league.commissionerIds.some((id: any) => String(id) === String(userId));

  if (!isOwner && !isComm) {
    return res
      .status(403)
      .json({ message: 'Commissioner or owner role required' });
  }
  return next();
};

export default requireCommissioner;
