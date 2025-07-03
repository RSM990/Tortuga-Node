const { validationResult } = require('express-validator');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const user = require('../models/user');

const SESSION_SECRET = process.env.SESSION_SECRET || 'somesupersecretsecret';

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
        SESSION_SECRET,
        { expiresIn: '1h' }
      );

      const isProd = process.env.NODE_ENV === 'production';
      const cookieOptions = {
        httpOnly: true,
        secure: isProd, // only true when running HTTPS in prod
        sameSite: isProd ? 'none' : 'lax', // cross-site in prod, lax in dev
        ...(isProd && { domain: '.tortugatest.com' }),
        maxAge: 1000 * 60 * 60, // 1 hour
      };

      res.cookie('token', token, cookieOptions);

      res.status(201).json({
        message: 'User created!',

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
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      SESSION_SECRET,
      { expiresIn: '1h' }
    );

    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProd, // only true when running HTTPS in prod
      sameSite: isProd ? 'none' : 'lax', // cross-site in prod, lax in dev
      ...(isProd && { domain: '.tortugatest.com' }),
      maxAge: 1000 * 60 * 60, // 1 hour
    };

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Not authenticated auth' });
  }

  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .populate('leagues');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const returnUser = {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      leagues: user.leagues,
    };

    return res.status(200).json({ data: returnUser });
  } catch (err) {
    console.error('Error fetching user:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
