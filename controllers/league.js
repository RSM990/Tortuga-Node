const { validationResult } = require('express-validator');

const League = require('../models/league');
const User = require('../models/user');

exports.createLeague = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }

  const name = req.body.name;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  let creator;

  const league = new League({
    name: name,
    startDate: startDate,
    endDate: endDate,
    createdBy: req.userId,
  });
  league
    .save()
    .then(() => {
      return User.findById(req.userId);
    })
    .then((user) => {
      creator = user;
      user.leagues.push(league);
      return user.save();
    })
    .then((result) => {
      res.status(201).json({
        message: 'League created successfully!',
        league: league,
        creator: {
          _id: creator._id,
          name: creator.name,
        },
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};
