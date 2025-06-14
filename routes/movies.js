const express = require('express');
const { body } = require('express-validator');
const isAuth = require('../middleware/is-auth');

const movieController = require('../controllers/movie');

const router = express.Router();

router.get('/', isAuth, movieController.getMovies);
router.get('/:movieId', movieController.getMovie);

router.post(
  '/',
  [body('director').trim().isLength({ min: 3 })],
  movieController.createMovie
);
router.post('/:movieId', movieController.updateMovie);

router.delete('/:movieId', movieController.deleteMovie);
module.exports = router;
