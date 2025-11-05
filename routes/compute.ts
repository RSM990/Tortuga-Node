import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import isAuth from '../middleware/is-auth.js';
import Season, { SeasonDoc } from '../models/Season.js';
import League, { LeagueDoc } from '../models/League.js';
import MovieWeeklyRevenue from '../models/MovieWeeklyRevenue.js';
import MovieOwnership from '../models/MovieOwnership.js';
import StudioWeeklyRevenue from '../models/StudioWeeklyRevenue.js';
import WeeklyRanking from '../models/WeeklyRankings.js';

const router = Router();

/**
 * Assumption for MVP:
 * - Week 0 starts at Season.startDate (commissioner picks a Tuesday)
 * - Weeks are contiguous blocks of 7 days (Tue–Mon if startDate is a Tuesday)
 * - Ranking/points are based on **worldwide** weekly totals (adjust later if desired)
 * - League.pointsScheme === 'optionB': use a simple points table
 */

const POINTS_TABLE_OPTION_B = [10, 8, 6, 5, 4, 3, 2, 1]; // fallback for top N

function computeWeekWindow(start: Date, weekIndex: number) {
  const ws = new Date(start.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
  const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000 - 1); // inclusive end
  return { weekStart: ws, weekEnd: we };
}

router.post(
  '/seasons/:id/compute/week/:weekIndex',
  isAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = req.params.id;
      const weekIndex = Number(req.params.weekIndex);
      if (!Number.isInteger(weekIndex) || weekIndex < 0) {
        return res
          .status(400)
          .json({ message: 'weekIndex must be a non-negative integer' });
      }

      const season = await Season.findById(seasonId).lean<SeasonDoc>();
      if (!season) return res.status(404).json({ message: 'Season not found' });

      const league = await League.findById(season.leagueId).lean<LeagueDoc>();
      if (!league) return res.status(404).json({ message: 'League not found' });

      const { weekStart, weekEnd } = computeWeekWindow(
        new Date(season.startDate),
        weekIndex
      );

      // 1) Get all ownerships for this season (movie -> studio)
      const ownerships = await MovieOwnership.find({ seasonId }).lean();
      const movieToStudio = new Map<string, { studioId: any }>();
      for (const o of ownerships) {
        movieToStudio.set(String(o.movieId), { studioId: o.studioId });
      }

      // 2) Get all movie weekly revenue rows that fall within the window (by weekStart)
      const revenues = await MovieWeeklyRevenue.find({
        weekStart: { $gte: weekStart, $lte: weekEnd },
      }).lean();

      // 3) Sum per studio
      const perStudio = new Map<
        string,
        { totalDomestic: number; totalWorldwide: number }
      >();
      for (const r of revenues) {
        const key = String(r.movieId);
        const owner = movieToStudio.get(key);
        if (!owner) continue; // movie not owned this season
        const sid = String(owner.studioId);
        const agg = perStudio.get(sid) || {
          totalDomestic: 0,
          totalWorldwide: 0,
        };
        agg.totalDomestic += Number(r.domesticGross || 0);
        agg.totalWorldwide += Number(r.worldwideGross || 0);
        perStudio.set(sid, agg);
      }

      // 4) Upsert StudioWeeklyRevenue for each studio with totals
      const upserts: any[] = [];
      for (const [studioId, totals] of perStudio.entries()) {
        const doc = await StudioWeeklyRevenue.findOneAndUpdate(
          { seasonId, weekIndex, studioId },
          {
            $set: {
              leagueId: season.leagueId,
              weekStart,
              weekEnd,
              totalDomesticGross: totals.totalDomestic,
              totalWorldwideGross: totals.totalWorldwide,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        upserts.push(doc);
      }

      // 5) Build ranking from totals (by worldwide)
      const ranked = [...perStudio.entries()]
        .map(([studioId, totals]) => ({
          studioId,
          revenue: totals.totalWorldwide,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const pointsTable =
        league.pointsScheme === 'optionB'
          ? POINTS_TABLE_OPTION_B
          : POINTS_TABLE_OPTION_B;

      const rows = ranked.map((row, i) => ({
        studioId: row.studioId,
        rank: i + 1,
        points: pointsTable[i] ?? 0,
        revenue: row.revenue,
      }));

      // 6) Upsert WeeklyRanking for this (season, weekIndex)
      const ranking = await WeeklyRanking.findOneAndUpdate(
        { seasonId, weekIndex },
        {
          $set: {
            leagueId: season.leagueId,
            rows,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({
        ok: true,
        window: { weekIndex, weekStart, weekEnd },
        studiosUpdated: upserts.length,
        ranking: ranking.rows,
      });
    } catch (e) {
      next(e);
    }
  }
);

// GET studio totals for a given week
router.get(
  '/seasons/:id/studios/week/:weekIndex',
  isAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = req.params.id;
      const weekIndex = Number(req.params.weekIndex);
      const docs = await StudioWeeklyRevenue.find({
        seasonId,
        weekIndex,
      }).lean();
      res.json(docs);
    } catch (e) {
      next(e);
    }
  }
);

// GET ranking table for a given week
router.get(
  '/seasons/:id/rankings/week/:weekIndex',
  isAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = req.params.id;
      const weekIndex = Number(req.params.weekIndex);
      const doc = await WeeklyRanking.findOne({ seasonId, weekIndex }).lean();
      if (!doc)
        return res.status(404).json({ message: 'No ranking for that week' });
      res.json(doc);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
