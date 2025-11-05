import { DateTime } from 'luxon';
import Season from '../models/season';
import League from '../models/league';
import MovieOwnership from '../models/movieOwnership';
import MovieWeeklyRevenue from '../models/movieWeeklyRevenue';
import StudioWeeklyRevenue from '../models/studioWeeklyRevenue';
import WeeklyRanking from '../models/weeklyRankings';

export async function computeWeek(seasonId: string, weekIndex: number) {
  const season = await Season.findById(seasonId).lean();
  if (!season) throw new Error('Season not found');

  const league = await League.findById(season.leagueId).lean();
  const tz = league?.timezone || 'America/New_York';

  // Derive Tue–Mon window (Luxon v3‑safe: avoid endOf() typing issues)
  const seasonStart = DateTime.fromJSDate(season.startDate, {
    zone: tz,
  }).startOf('day');
  const weekStart = seasonStart
    .plus({ weeks: weekIndex })
    .plus({ days: (2 - seasonStart.weekday + 7) % 7 })
    .startOf('day');
  const weekEnd = weekStart
    .plus({ days: 6 })
    .set({ hour: 23, minute: 59, second: 59, millisecond: 999 });

  const ownerships = await MovieOwnership.find({ seasonId }).lean();

  const ownerByMovie = new Map<string, string>();
  ownerships.forEach((o) => {
    const active =
      (!o.retiredAt || o.retiredAt >= weekStart.toJSDate()) &&
      o.acquiredAt <= weekEnd.toJSDate();
    if (active) ownerByMovie.set(String(o.movieId), String(o.studioId));
  });

  const revDocs = await MovieWeeklyRevenue.find({
    weekStart: weekStart.toJSDate(),
  }).lean();

  const studioTotals = new Map<string, { revenue: number }>();
  for (const r of revDocs) {
    const studioId = ownerByMovie.get(String(r.movieId));
    if (!studioId) continue;
    const entry = studioTotals.get(studioId) || { revenue: 0 };
    entry.revenue += r.domesticGross;
    studioTotals.set(studioId, entry);
  }

  for (const [studioId, { revenue }] of studioTotals) {
    await StudioWeeklyRevenue.updateOne(
      { seasonId, studioId, weekIndex },
      {
        $set: {
          leagueId: season.leagueId,
          weekStart: weekStart.toJSDate(),
          weekEnd: weekEnd.toJSDate(),
          totalDomesticGross: revenue,
        },
      },
      { upsert: true }
    );
  }

  const rows = Array.from(studioTotals.entries()).map(([studioId, v]) => ({
    studioId,
    revenue: v.revenue,
  }));
  rows.sort((a, b) => b.revenue - a.revenue);
  const N = rows.length;
  let i = 0;
  const ranked: any[] = [];
  const pointFor = (pos: number) => 2 * N - 2 * (pos - 1);
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && rows[j].revenue === rows[i].revenue) j++;
    const rank = i + 1;
    const span = j - i;
    const sumPts = Array.from({ length: span }, (_, k) =>
      pointFor(rank + k)
    ).reduce((a, b) => a + b, 0);
    const avgPts = sumPts / span;
    for (let k = i; k < j; k++)
      ranked.push({ ...rows[k], rank, points: avgPts });
    i = j;
  }

  await WeeklyRanking.updateOne(
    { seasonId, weekIndex },
    { $set: { leagueId: season.leagueId, rows: ranked } },
    { upsert: true }
  );
}
