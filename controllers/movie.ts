// src/controllers/movie.ts
import type { Request, Response, NextFunction } from 'express';
import Movie from '../models/Movie.js';
import {
  buildBracketFilter,
  buildFriendlyMovieFilter,
  mergeConditions,
} from '../utils/query.js';

// Helpers
const toInt = (val: unknown, def: number) => {
  const n = parseInt(String(val ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
};

// Convert plain value to case-insensitive exact-match RegExp
const toCiExact = (val: unknown): RegExp =>
  val instanceof RegExp
    ? val
    : new RegExp(
        `^${String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );

async function getMovies(req: Request, res: Response, next: NextFunction) {
  try {
    // paging
    const page = Math.max(toInt(req.query.page, 1), 1);
    const limit = Math.max(toInt(req.query.limit, 20), 1);
    const skip = (page - 1) * limit;

    // filters
    const friendly = buildFriendlyMovieFilter(req.query as Record<string, any>);
    const bracket = buildBracketFilter(req.query as Record<string, any>, {
      dateFields: ['releaseDate'],
      arrayFields: ['genres'],
      // numberFields: [] // extend later
    });

    let q: Record<string, any> = mergeConditions(friendly, bracket);

    // normalize genres[in]
    if (
      q.genres &&
      q.genres.$in &&
      Array.isArray(q.genres.$in) &&
      q.genres.$in.length > 0
    ) {
      const arr = q.genres.$in;
      delete q.genres;

      q.$or = (q.$or || []).concat(
        arr.flatMap((val: unknown) => {
          const re = toCiExact(val);
          return [
            { genres: { $elemMatch: { $regex: re } } }, // genres: string[]
            { genre: { $regex: re } }, // genre: string (fallback shape)
          ];
        })
      );
    }

    // sorting
    const sort = String(req.query.sort ?? '');
    let sortSpec: Record<string, 1 | -1> = { releaseDate: -1, _id: -1 };
    if (sort === 'releaseDate_asc') sortSpec = { releaseDate: 1, _id: 1 };
    if (sort === 'releaseDate_desc') sortSpec = { releaseDate: -1, _id: -1 };

    // execute
    const [items, total] = await Promise.all([
      Movie.find(q).sort(sortSpec).skip(skip).limit(limit).lean(),
      Movie.countDocuments(q),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      meta: {
        success: true,
        message: 'Movies fetched successfully.',
        page,
        total,
        totalPages,
      },
      data: items,
    });
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

async function getMovie(req: Request, res: Response, next: NextFunction) {
  try {
    const movie = await Movie.findById(req.params.movieId).lean();
    if (!movie) {
      return res.status(404).json({
        meta: {
          success: false,
          message: 'Movie not found',
          page: 1,
          total: 0,
          totalPages: 1,
        },
        data: null,
      });
    }
    return res.json({
      meta: {
        success: true,
        message: 'Movie fetched',
        page: 1,
        total: 1,
        totalPages: 1,
      },
      data: movie,
    });
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

async function getDistinctGenres(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // genres from array
    const rows = await Movie.aggregate([
      {
        $project: {
          genresArray: {
            $cond: [
              { $isArray: '$genres' },
              {
                $filter: {
                  input: '$genres',
                  as: 'g',
                  cond: {
                    $and: [
                      { $ne: ['$$g', null] },
                      { $ne: ['$$g', ''] },
                      { $eq: [{ $type: '$$g' }, 'string'] },
                    ],
                  },
                },
              },
              [],
            ],
          },
        },
      },
      { $unwind: { path: '$genresArray', preserveNullAndEmptyArrays: false } },
      { $group: { _id: { $toLower: '$genresArray' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 500 },
    ]);

    // single-string fallback “genre”
    const single = await Movie.aggregate([
      {
        $project: {
          genre: {
            $cond: [
              { $and: [{ $ne: ['$genre', null] }, { $ne: ['$genre', ''] }] },
              { $toLower: '$genre' },
              null,
            ],
          },
        },
      },
      { $match: { genre: { $ne: null } } },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 500 },
    ]);

    // merge
    const map = new Map<string, number>();
    for (const r of rows) map.set(r._id, (map.get(r._id) || 0) + r.count);
    for (const r of single) map.set(r._id, (map.get(r._id) || 0) + r.count);

    const merged = Array.from(map.entries())
      .filter(([g]) => g && g.trim() !== '')
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);

    // diagnostics
    const [total, withGenresArray, withGenreString] = await Promise.all([
      Movie.countDocuments({}),
      Movie.countDocuments({
        genres: { $exists: true, $type: 'array', $not: { $size: 0 } },
      }),
      Movie.countDocuments({ genre: { $exists: true, $ne: '' } }),
    ]);

    return res.json({
      meta: {
        success: true,
        message: 'Distinct genres',
        page: 1,
        total: merged.length,
        totalPages: 1,
        diagnostics: {
          totalDocs: total,
          hasGenresArray: withGenresArray,
          hasGenreString: withGenreString,
        },
      },
      data: merged,
    });
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

const movieController = {
  getMovies,
  getMovie,
  getDistinctGenres,
  // createMovie,
  // updateMovie,
  // deleteMovie,
};

export default movieController;
