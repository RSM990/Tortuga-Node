// src/routes/movies.ts
import { Router } from 'express';
import { body } from 'express-validator';

import isAuth from '../middleware/is-auth.js';
import movieController from '../controllers/movie.js'; // default export expected

const router = Router();

// READ
router.get('/', isAuth, movieController.getMovies);
// router.get('/genres', isAuth, movieController.getDistinctGenres);
router.get('/:movieId', isAuth, movieController.getMovie);

// Shared validators for create/update
const createUpdateRules = [
  body('title')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Title is required'),
  body('releaseDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('releaseDate must be an ISO date'),
  body('director')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Director must be at least 3 chars'),
  body('slug').optional({ checkFalsy: true }).isString().trim(),
  body('genres')
    .optional({ nullable: true })
    .isArray()
    .withMessage('genres must be an array of strings'),
  body('genres.*').optional({ nullable: true }).isString().trim(),
  body('runtimeMin')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('runtimeMin must be a positive integer'),
  body('posterUrl')
    .optional({ nullable: true })
    .isURL()
    .withMessage('posterUrl must be a URL'),
  body('sources').optional({ nullable: true }).isObject(),
  body('sources.bom').optional({ nullable: true }).isObject(),
  body('sources.bom.url').optional({ nullable: true }).isURL(),
  body('sources.bom.bomId').optional({ nullable: true }).isString(),
  body('sources.tmdb').optional({ nullable: true }).isObject(),
  body('sources.tmdb.id').optional({ nullable: true }).isString(),
];

// WRITE (uncomment if/when you’re ready—ensure controller handlers exist)
// router.post('/', isAuth, createUpdateRules, movieController.createMovie);
// router.patch('/:movieId', isAuth, createUpdateRules, movieController.updateMovie);
// router.delete('/:movieId', isAuth, movieController.deleteMovie);

export default router;
