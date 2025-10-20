const express = require('express');
const { body } = require('express-validator');
const isAuth = require('../middleware/is-auth');
const movieController = require('../controllers/movie');

const router = express.Router();

router.get('/', isAuth, movieController.getMovies);
router.get('/genres', isAuth, movieController.getDistinctGenres);
router.get('/:movieId', isAuth, movieController.getMovie);

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

// router.post('/', createUpdateRules, movieController.createMovie);
// router.patch('/:movieId', createUpdateRules, movieController.updateMovie);

// router.delete('/:movieId', movieController.deleteMovie);

module.exports = router;
