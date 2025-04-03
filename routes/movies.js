const express = require('express');

const movieController = require('../controllers/movie');

const router = express.Router();

router.get('/', movieController.getMovies);
router.get('/:movieId', movieController.getMovie);

router.post('/', movieController.createMovie);
router.post('/:movieId', movieController.updateMovie);

router.delete('/:movieId', movieController.deleteMovie);
module.exports = router;
