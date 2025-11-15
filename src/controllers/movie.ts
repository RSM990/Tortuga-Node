/**
 * Movies Controller
 *
 * Updated with Winston logging
 *
 * Changes from previous version:
 * - Replaced console.error with logger.error
 * - Added logger.info for successful operations
 * - Added logger.debug for development insights
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
 * ✅ Get all movies (paginated)
 * GET /api/movies
 */
async function getMovies(req: Request, res: Response) {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);

    logger.debug('Fetching movies', { page, limit });

    const [movies, total] = await Promise.all([
      Movie.find().skip(skip).limit(limit).lean(),
      Movie.countDocuments(),
    ]);

    logger.info('Movies fetched successfully', {
      count: movies.length,
      total,
      page,
      limit,
    });

    return sendPaginatedResponse(res, movies, { page, limit, total });
  } catch (error) {
    logger.error('Failed to fetch movies', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
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
