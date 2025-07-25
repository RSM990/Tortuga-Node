const { validationResult } = require('express-validator');
const Movie = require('../models/movie');
const APIFeatures = require('../utils/apiFeatures');
//CREATE
exports.createMovie = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors.array());
      const error = new Error('Validation failed.');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const movie = await Movie.create(req.body);

    res.status(201).json({
      message: 'New movie created successfully!',
      movie,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || 'An error occurred while creating the movie.',
      error: err.data || null,
    });
    next(err);
  }
};

//READ
exports.getMovies = async (req, res, next) => {
  try {
    const api = new APIFeatures(Movie.find(), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const movies = await api.query;

    const moviesCount = await Movie.countDocuments();

    res.status(200).json({
      meta: {
        success: true,
        message: 'Obtained all movies successfully.',
        page: api.queryString.page || 1,
        totalPages: Math.ceil(moviesCount / (api.queryString.limit || 10)),
        total: moviesCount,
      },
      data: movies,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getMovie = async (req, res, next) => {
  try {
    const movieId = req.params.movieId;
    const movie = await Movie.findById(movieId);
    res.status(200).json({
      meta: {
        success: true,
        message: 'Movie obtained successfully.',
        page: 1,
        totalPages: 1,
        total: 1,
      },
      movie,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

//UPDATE
exports.updateMovie = async (req, res, next) => {
  try {
    const movie = await Movie.findByIdAndUpdate(req.params.movieId, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      meta: {
        success: true,
        message: 'Movie updated successfully.',
        page: 1,
        totalPages: 1,
        total: 1,
      },
      movie,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

//DELETE
exports.deleteMovie = async (req, res, next) => {
  try {
    const movieId = req.params.movieId;
    await Movie.findByIdAndDelete(movieId);

    res.status(204).json({
      meta: {
        success: true,
        message: 'Movie deleted successfully.',
        page: 1,
        totalPages: 1,
        total: 0,
      },
      data: null,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
