const { validationResult } = require('express-validator');
const Movie = require('../models/movie');

//CREATE
exports.createMovie = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array());
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  const title = req.body.title;
  const releaseDate = req.body.releaseDate;
  const director = req.body.director;
  const imageUrl = req.body.imageUrl;
  const distributor = req.body.distributor;
  const movie = new Movie({
    title,
    releaseDate,
    director,
    imageUrl,
    distributor,
  });
  movie
    .save()
    .then((result) => {
      res.status(201).json({
        message: 'Product created successfully!',
        product: result,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

//READ
exports.getMovies = (req, res, next) => {
  Movie.find()
    .sort({ releaseDate: 1 })
    .then((movies) => {
      res.status(200).json({
        meta: {
          success: true,
          message: 'Obtained all movies successfully.',
          page: 1,
          totalPages: 200,
          total: 20000,
        },
        data: movies,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getMovie = (req, res, next) => {
  const movieId = req.params.movieId;
  Movie.findById(movieId)
    .then((movie) => {
      if (!movie) {
        const error = new Error('Movie not found.');
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({
        message: 'Movie obtained successfully.',
        movie,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

//UPDATE
exports.updateMovie = (req, res, next) => {
  const movieId = req.params.movieId;
  const updatedTitle = req.body.title;
  const updatedReleaseDate = req.body.releaseDate;
  const updatedDirector = req.body.director;
  const updatedImageUrl = req.body.imageUrl;
  Movie.findById(movieId)
    .then((movie) => {
      if (!movie) {
        const error = new Error('Movie not found.');
        error.statusCode = 404;
        throw error;
      }
      movie.title = updatedTitle;
      movie.releaseDate = updatedReleaseDate;
      movie.director = updatedDirector;
      movie.imageUrl = updatedImageUrl;
      return movie.save();
    })
    .then((result) => {
      res.status(200).json({
        message: 'Movie updated successfully.',
        movie: result,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

//DELETE
exports.deleteMovie = (req, res, next) => {
  const movieId = req.params.movieId;
  Movie.findByIdAndDelete(movieId)
    .then(() => {
      res.status(200).json({
        message: 'Movie deleted successfully.',
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};
