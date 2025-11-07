import League from '../models/League.js';
import { toSlug, escapeRegex } from '../utils/slug.js';

/**
 * Use aggregation to find the max numeric suffix for a base slug.
 * Matches: ^base$ and ^base-(\d+)$ (anchored; uses { slug: 1 } index efficiently).
 */
export async function nextAvailableLeagueSlugAgg(nameOrSlug: string) {
  const base = toSlug(nameOrSlug);
  if (!base) return { base: '', suggested: '', count: 0, isAvailable: true };

  const anchored = `^${escapeRegex(base)}(?:-(\\d+))?$`;

  const pipeline = [
    { $match: { slug: { $regex: anchored } } },
    {
      $project: {
        isBase: { $cond: [{ $eq: ['$slug', base] }, 1, 0] },
        // Extract numeric suffix if present, else 0
        n: {
          $let: {
            vars: {
              m: {
                $regexFind: {
                  input: '$slug',
                  regex: new RegExp(`^${escapeRegex(base)}-(\\d+)$`),
                },
              },
            },
            in: {
              $cond: [
                { $gt: ['$$m', null] },
                { $toInt: { $arrayElemAt: ['$$m.captures', 0] } },
                0,
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        maxN: { $max: '$n' },
        hasBase: { $max: '$isBase' },
        count: { $sum: 1 },
      },
    },
  ] as any;

  const rows = await League.aggregate(pipeline).exec();

  if (!rows.length) {
    return { base, suggested: base, count: 0, isAvailable: true };
  }

  const { maxN, hasBase, count } = rows[0] as {
    maxN: number;
    hasBase: 0 | 1;
    count: number;
  };

  // If no base and no numeric variants, suggest base; else base-(maxN+1)
  const suggested = hasBase || maxN > 0 ? `${base}-${maxN + 1}` : base;
  return { base, suggested, count, isAvailable: suggested === base };
}

/**
 * Atomically assign a unique slug using unique index on `slug`.
 * Tries the aggregation suggestion first, then increments on duplicate key.
 */
export async function assignLeagueSlugAtomic(
  baseNameOrSlug: string,
  createFn: (slug: string) => Promise<any>
) {
  const base = toSlug(baseNameOrSlug);
  if (!base) throw new Error('Invalid name/slug');

  const { suggested } = await nextAvailableLeagueSlugAgg(base);
  let attempt = suggested;

  const MAX_RETRIES = 6;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await createFn(attempt);
    } catch (err: any) {
      const dup = err?.code === 11000 || /E11000/.test(err?.message || '');
      if (!dup) throw err;

      const m = attempt.match(/-(\d+)$/);
      const nextN = m ? parseInt(m[1], 10) + 1 : 1;
      attempt = `${base}-${nextN}`;
    }
  }
  throw new Error('Failed to assign unique slug after multiple attempts.');
}
