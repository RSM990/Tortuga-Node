// controllers/movie.js
'use strict';

const Movie = require('../models/movie');
const {
  buildBracketFilter,
  buildFriendlyMovieFilter,
  mergeConditions,
} = require('../utils/query');

/**
 * GET /api/movies
 * Supports friendly params and bracket operators:
 *  - page, limit
 *  - name|title (case-insensitive contains)
 *  - studio      (maps to distributor, case-insensitive exact)
 *  - genre       (matches array 'genres' or string 'genre', case-insensitive)
 *  - releaseDateStart / releaseDateEnd
 *  - bracket style: releaseDate[gte], releaseDate[lte], genres[in]=a,b
 *  - sort: releaseDate_desc | releaseDate_asc
 */
exports.getMovies = async (req, res, next) => {
  try {
    // ---- paging ----
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const skip = (page - 1) * limit;

    // ---- filters: friendly + bracket ----
    const friendly = buildFriendlyMovieFilter(req.query);
    const bracket = buildBracketFilter(req.query, {
      dateFields: ['releaseDate'],
      arrayFields: ['genres'],
      // numberFields: [] // add if needed later
    });

    let q = mergeConditions(friendly, bracket);

    // ---- SPECIAL: make genres[in] robust, case-insensitive, and tolerant of both shapes
    //    - convert { genres: { $in: [...] } } into:
    //      { $or: [{ genres: { $elemMatch: /.../i } }, { genre: /.../i }, ...] }
    if (
      q.genres &&
      q.genres.$in &&
      Array.isArray(q.genres.$in) &&
      q.genres.$in.length > 0
    ) {
      const arr = q.genres.$in;
      delete q.genres;

      const toRegex = (val) =>
        val instanceof RegExp
          ? val
          : new RegExp(
              `^${String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
              'i'
            );

      q.$or = (q.$or || []).concat(
        arr.flatMap((val) => {
          const re = toRegex(val);
          return [
            { genres: { $elemMatch: { $regex: re } } }, // genres: array of strings
            { genre: { $regex: re } }, // genre: single string (if any docs)
          ];
        })
      );
    }

    // ---- sorting ----
    const { sort } = req.query;
    let sortSpec = { releaseDate: -1, _id: -1 };
    if (sort === 'releaseDate_asc') sortSpec = { releaseDate: 1, _id: 1 };
    if (sort === 'releaseDate_desc') sortSpec = { releaseDate: -1, _id: -1 };

    // ---- execute ----
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
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

/**
 * GET /api/movies/:movieId
 */
exports.getMovie = async (req, res, next) => {
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
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

/**
 * GET /api/movies/genres
 * Returns distinct genres (lowercased) with counts.
 * Defensive against missing/empty/non-array fields and provides diagnostics.
 */
exports.getDistinctGenres = async (req, res, next) => {
  try {
    // Aggregate genres from array form
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

    // Aggregate genres if stored as single string "genre" (rare/fallback)
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

    // Merge results
    const map = new Map();
    for (const r of rows) map.set(r._id, (map.get(r._id) || 0) + r.count);
    for (const r of single) map.set(r._id, (map.get(r._id) || 0) + r.count);

    const merged = Array.from(map.entries())
      .filter(([g]) => g && g.trim() !== '')
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);

    // Diagnostics
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
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
