// middleware/enforceAcquisitionWindow.ts
import { DateTime } from 'luxon';
import League, { LeagueDoc } from '../models/League.js';
import { Request, Response, NextFunction } from 'express';

export async function enforceAcquisitionWindow(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const leagueId = req.params.leagueId || req.body.leagueId;
  const league = await League.findById(leagueId).lean<LeagueDoc>();
  const tz: string = (league?.timezone as string) || 'America/New_York'; // ← Add type annotation
  const now = DateTime.now().setZone(tz);
  const isLocked =
    (now.weekday === 5 && now.hour >= 20) || // Thu >= 8pm
    now.weekday === 6 || // Fri
    now.weekday === 7 || // Sat
    now.weekday === 1; // Mon
  // Above uses Luxon weekdays (1=Mon ... 7=Sun). Adjust for Tue–Mon window:
  // Acquisition allowed Tue (2) 00:00 through Thu (5) 19:59.
  const allowed =
    now.weekday === 2 ||
    now.weekday === 3 ||
    now.weekday === 4 ||
    (now.weekday === 5 && now.hour < 20);
  if (!allowed)
    return res.status(403).json({
      message: 'Roster acquisitions are locked for the current scoring week.',
    });
  next();
}
