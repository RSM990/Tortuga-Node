const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const SESSION_SECRET = process.env.SESSION_SECRET || 'somesupersecretsecret';

const cookieOptionsForEnv = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    ...(isProd && { domain: '.tortugatest.com' }),
    path: '/',
    maxAge: 1000 * 60 * 60, // 1 hour
  };
};

exports.signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(422)
      .json({ message: 'Validation failed', data: errors.array() });

  const { email, password, firstName, lastName } = req.body;
  const hashedPw = await bcrypt.hash(password, 12);
  const user = new User({ email, password: hashedPw, firstName, lastName });
  const result = await user.save();

  const token = jwt.sign(
    { userId: result._id.toString(), email: result.email },
    SESSION_SECRET,
    { expiresIn: '1h' }
  );
  res.cookie('token', token, cookieOptionsForEnv());

  const safeUser = {
    id: result._id.toString(),
    email: result.email,
    firstName: result.firstName,
    lastName: result.lastName,
    leagues: result.leagues,
  };
  return res.status(201).json({ token, user: safeUser });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.status(401).json({ message: 'Invalid email or password' });
  const ok = await bcrypt.compare(password, u.password);
  if (!ok)
    return res.status(401).json({ message: 'Invalid email or password' });

  const token = jwt.sign(
    { userId: u._id.toString(), email: u.email },
    SESSION_SECRET,
    { expiresIn: '1h' }
  );
  res.cookie('token', token, cookieOptionsForEnv());

  const safeUser = {
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    leagues: u.leagues,
  };
  return res.status(200).json({ token, user: safeUser });
};

exports.logout = async (_req, res) => {
  res.clearCookie('token', {
    path: '/',
    ...(process.env.NODE_ENV === 'production'
      ? { domain: '.tortugatest.com', sameSite: 'none', secure: true }
      : {}),
  });
  return res.status(200).json({ ok: true });
};

exports.getUser = async (req, res) => {
  const u = await User.findById(req.userId).populate('leagues');
  if (!u) return res.status(404).json({ message: 'User not found' });
  const safeUser = {
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    leagues: u.leagues,
  };
  return res.status(200).json(safeUser); // return the user object directly
};

exports.updateMe = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(422)
      .json({ message: 'Validation failed', data: errors.array() });

  const { firstName, lastName } = req.body;
  const u = await User.findById(req.userId);
  if (!u) return res.status(404).json({ message: 'User not found' });

  if (typeof firstName === 'string' && firstName.trim())
    u.firstName = firstName.trim();
  if (typeof lastName === 'string' && lastName.trim())
    u.lastName = lastName.trim();
  await u.save();

  const safeUser = {
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    leagues: u.leagues,
  };
  return res.status(200).json(safeUser);
};

exports.updatePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(422)
      .json({ message: 'Validation failed', data: errors.array() });

  const { currentPassword, newPassword } = req.body;
  const u = await User.findById(req.userId);
  if (!u) return res.status(404).json({ message: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, u.password);
  if (!ok)
    return res.status(401).json({ message: 'Current password is incorrect' });

  u.password = await bcrypt.hash(newPassword, 12);
  await u.save();

  return res.status(200).json({ ok: true });
};
