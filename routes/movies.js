const express = require('express');
const { body } = require('express-validator');

const movieController = require('../controllers/movie');

const router = express.Router();

router.get('/', movieController.getMovies);
router.get('/:movieId', movieController.getMovie);

router.post(
  '/',
  [
    body('title').trim().isLength({ min: 3 }),
    body('director').trim().isLength({ min: 3 }),
  ],
  movieController.createMovie
);
router.post('/:movieId', movieController.updateMovie);

router.delete('/:movieId', movieController.deleteMovie);
module.exports = router;
