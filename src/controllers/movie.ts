// src/controllers/movie.ts
import type { Request, Response, NextFunction } from 'express';
import Movie from '../models/Movie.js';
import {
  buildBracketFilter,
  buildFriendlyMovieFilter,
  mergeConditions,
} from '../utils/query.js';
import { paginatedResponse, parsePaginationParams } from '../utils/response.js';

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
    // Parse and validate pagination params
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Build filters
    const friendly = buildFriendlyMovieFilter(req.query as Record<string, any>);
    const bracket = buildBracketFilter(req.query as Record<string, any>, {
      dateFields: ['releaseDate'],
      arrayFields: ['genres'],
    });

    let q: Record<string, any> = mergeConditions(friendly, bracket);

    // Normalize genres[in]
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
            { genres: { $elemMatch: { $regex: re } } },
            { genre: { $regex: re } },
          ];
        })
      );
    }

    // Sorting
    const sort = String(req.query.sort ?? '');
    let sortSpec: Record<string, 1 | -1> = { releaseDate: -1, _id: -1 };
    if (sort === 'releaseDate_asc') sortSpec = { releaseDate: 1, _id: 1 };
    if (sort === 'releaseDate_desc') sortSpec = { releaseDate: -1, _id: -1 };

    // Execute query
    const [items, total] = await Promise.all([
      Movie.find(q).sort(sortSpec).skip(skip).limit(limit).lean(),
      Movie.countDocuments(q),
    ]);

    // ✅ STANDARDIZED RESPONSE
    return res.json(paginatedResponse(items, page, limit, total));
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

async function getMovie(req: Request, res: Response, next: NextFunction) {
  try {
    const movie = await Movie.findById(req.params.movieId).lean();
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    // Single resource - just return the object
    return res.json(movie);
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
    // Genres from array field
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

    // Single-string fallback "genre" field
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

    // Merge and deduplicate
    const map = new Map<string, number>();
    for (const r of rows) map.set(r._id, (map.get(r._id) || 0) + r.count);
    for (const r of single) map.set(r._id, (map.get(r._id) || 0) + r.count);

    const merged = Array.from(map.entries())
      .filter(([g]) => g && g.trim() !== '')
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);

    // Return as simple array (not paginated)
    return res.json(merged);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

const movieController = {
  getMovies,
  getMovie,
  getDistinctGenres,
  // createMovie,    // TODO: implement when needed
  // updateMovie,    // TODO: implement when needed
  // deleteMovie,    // TODO: implement when needed
};

export default movieController;
