const { validationResult } = require('express-validator');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const user = require('../models/user');

const DUMMY_SECRET = 'somesupersecretsecret';

exports.signup = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  const email = req.body.email;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const password = req.body.password;
  bcrypt
    .hash(password, 12)
    .then((hashedPw) => {
      const user = new User({
        email: email,
        password: hashedPw,
        firstName: firstName,
        lastName: lastName,
      });
      return user.save();
    })
    .then((result) => {
      const token = jwt.sign(
        { email: result.email, userId: result._id.toString() },
        DUMMY_SECRET,
        { expiresIn: '1h' }
      );

      res.cookie('apiToken', token, {
        httpOnly: true,
        secure: false, // Only over HTTPS
        sameSite: 'Lax', // or 'Lax'
        maxAge: 1000 * 60 * 60, // 1 hour
      });

      res.status(201).json({
        message: 'User created!',
        token: token,
        user: {
          id: result._id.toString(),
          email: result.email,
          firstName: result.firstName,
          lastName: result.lastName,
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

exports.login = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  let loadedUser;
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        const error = new Error('A user with this email could not be found.');
        error.statusCode = 401;
        throw error;
      }
      loadedUser = user;
      return bcrypt.compare(password, user.password);
    })
    .then((isEqual) => {
      if (!isEqual) {
        const error = new Error('Wrong password!');
        error.statusCode = 401;
        throw error;
      }
      const token = jwt.sign(
        { email: loadedUser.email, userId: loadedUser._id.toString() },
        DUMMY_SECRET,
        { expiresIn: '1h' }
      );

      res.cookie('apiToken', token, {
        httpOnly: true,
        secure: false, // Only over HTTPS
        sameSite: 'Lax', // or 'Lax'
        maxAge: 1000 * 60 * 60, // 1 hour
      });

      res.status(200).json({
        token: token,
        user: {
          id: loadedUser._id.toString(),
          email: loadedUser.email,
          firstName: loadedUser.firstName,
          lastName: loadedUser.lastName,
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

exports.getUser = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(200).json({ message: 'Not authenticated', data: null });
    }
    const user = await User.findById(req.userId)
      .select('-password')
      .populate('leagues'); // sanitize
    if (!user) return res.status(404).json({ message: 'User not found' });

    const returnUser = {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      leagues: user.leagues,
    };
    console.log('User found:', returnUser);

    res.status(200).json({
      token: 'this was the token',
      data: returnUser,
    });
  } catch (err) {
    res.status(200).json({ message: 'Server error', data: null });
  }
};
