/**
 * Movies Controller
 *
 * Updated with Winston logging and filter support
 *
 * Changes from previous version:
 * - Replaced console.error with logger.error
 * - Added logger.info for successful operations
 * - Added logger.debug for development insights
 * - Added comprehensive filtering support (name, studio, genre, date range)
 * - Added sorting support (releaseDate asc/desc)
 */

import { Request, Response } from 'express';
import Movie from '../models/Movie.js';
import logger from '../config/logger.js';
import {
  HttpStatus,
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse,
  parsePaginationParams,
} from '../utils/response.js';

/**
 * ✅ Get all movies (paginated with filters)
 * GET /api/movies?page=1&limit=20&name=avatar&studio=Universal&genre=Action&releaseDateStart=2020-01-01&releaseDateEnd=2024-12-31&sort=releaseDate_desc
 */
async function getMovies(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Extract filter parameters
    const {
      name,
      studio,
      genre,
      releaseDateStart,
      releaseDateEnd,
      sort = 'releaseDate_asc',
    } = req.query;

    // Build filter object
    const filter: any = {};

    // Title search (case-insensitive partial match)
    if (name && typeof name === 'string') {
      filter.title = { $regex: name, $options: 'i' };
    }

    // Studio filter (exact match on distributor field)
    if (studio && typeof studio === 'string') {
      filter.distributor = studio;
    }

    // Genre filter (movie must include this genre)
    if (genre && typeof genre === 'string') {
      filter.genres = genre;
    }

    // Date range filter
    // Default: Only show movies releasing today or later
    filter.releaseDate = {};
    
    if (releaseDateStart && typeof releaseDateStart === 'string') {
      const startDate = new Date(releaseDateStart);
      if (!isNaN(startDate.getTime())) {
        filter.releaseDate.$gte = startDate;
      }
    } else {
      // Default to today if not specified
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.releaseDate.$gte = today;
    }
    
    if (releaseDateEnd && typeof releaseDateEnd === 'string') {
      const endDate = new Date(releaseDateEnd);
      if (!isNaN(endDate.getTime())) {
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
        filter.releaseDate.$lte = endDate;
      }
    }

    // Build sort object
    const sortObj: any = {};
    if (sort === 'releaseDate_desc') {
      sortObj.releaseDate = -1;
    } else {
      // Default: oldest first (releaseDate_asc) - shows upcoming movies chronologically
      sortObj.releaseDate = 1;
    }

    logger.debug('Fetching movies with filters', {
      page,
      limit,
      filter,
      sort: sortObj,
    });

    // Execute query with filters and count
    const [movies, total] = await Promise.all([
      Movie.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      Movie.countDocuments(filter),
    ]);

    logger.info('Movies fetched successfully', {
      count: movies.length,
      total,
      page,
      limit,
      filtersApplied: Object.keys(filter).length,
    });

    return sendPaginatedResponse(res, movies, { page, limit, total });
  } catch (error) {
    logger.error('Failed to fetch movies', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      query: req.query,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch movies'
    );
  }
}

/**
 * ✅ Get single movie by ID
 * GET /api/movies/:id
 */
async function getMovie(req: Request, res: Response) {
  try {
    const { id } = req.params;

    logger.debug('Fetching movie by ID', { movieId: id });

    const movie = await Movie.findById(id).lean();

    if (!movie) {
      logger.warn('Movie not found', { movieId: id });
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Movie not found');
    }

    logger.info('Movie fetched successfully', {
      movieId: id,
      title: movie.title,
    });

    return sendSuccessResponse(res, movie);
  } catch (error) {
    logger.error('Failed to fetch movie', {
      movieId: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch movie'
    );
  }
}

/**
 * ✅ Search movies
 * GET /api/movies/search?q=query
 */
async function searchMovies(req: Request, res: Response) {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      logger.warn('Search attempted without query', { query: q });
      return sendErrorResponse(
        res,
        HttpStatus.BAD_REQUEST,
        'Search query is required'
      );
    }

    logger.debug('Searching movies', { query: q });

    const movies = await Movie.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { overview: { $regex: q, $options: 'i' } },
      ],
    })
      .limit(20)
      .lean();

    logger.info('Movie search completed', {
      query: q,
      resultsFound: movies.length,
    });

    return sendSuccessResponse(res, movies);
  } catch (error) {
    logger.error('Movie search failed', {
      query: req.query.q,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to search movies'
    );
  }
}

export default {
  getMovies,
  getMovie,
  searchMovies,
};
