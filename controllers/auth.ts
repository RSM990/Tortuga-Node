// src/controllers/auth.ts
import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'somesupersecretsecret';

const cookieOptionsForEnv = (): CookieOptions => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.tortugatest.com' : undefined,
    path: '/',
    maxAge: 1000 * 60 * 60, // 1h
  };
};

type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  leagues: unknown;
};

const makeSafeUser = (u: any): SafeUser => ({
  id: String(u._id),
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  leagues: u.leagues,
});

// NOTE: `is-auth` middleware should set `req.userId`.
// If you want typings, you can augment Express.Request in a global .d.ts.
// For now, use `(req as any).userId`.
const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(422)
        .json({ message: 'Validation failed', data: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };

    const hashedPw = await bcrypt.hash(password, 12);
    const user = new (User as any)({
      email,
      password: hashedPw,
      firstName,
      lastName,
    });
    const result = await user.save();

    const token = jwt.sign(
      { userId: String(result._id), email: result.email },
      SESSION_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, cookieOptionsForEnv());
    return res.status(201).json({ token, user: makeSafeUser(result) });
  } catch (e) {
    next(e);
  }
}

async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const u = await (User as any).findOne({ email });
    if (!u)
      return res.status(401).json({ message: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok)
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign(
      { userId: String(u._id), email: u.email },
      SESSION_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, cookieOptionsForEnv());
    return res.status(200).json({ token, user: makeSafeUser(u) });
  } catch (e) {
    next(e);
  }
}

async function logout(_req: Request, res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  const clearOpts: CookieOptions = {
    path: '/',
    ...(isProd
      ? { domain: '.tortugatest.com', sameSite: 'none', secure: true }
      : {}),
  };
  res.clearCookie('token', clearOpts);
  return res.status(200).json({ ok: true });
}

async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const u = await (User as any).findById(userId).populate('leagues');
    if (!u) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json(makeSafeUser(u));
  } catch (e) {
    next(e);
  }
}

async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(422)
        .json({ message: 'Validation failed', data: errors.array() });
    }

    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { firstName, lastName } = req.body as {
      firstName?: string;
      lastName?: string;
    };
    const u = await (User as any).findById(userId);
    if (!u) return res.status(404).json({ message: 'User not found' });

    if (typeof firstName === 'string' && firstName.trim())
      u.firstName = firstName.trim();
    if (typeof lastName === 'string' && lastName.trim())
      u.lastName = lastName.trim();
    await u.save();

    return res.status(200).json(makeSafeUser(u));
  } catch (e) {
    next(e);
  }
}

async function updatePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(422)
        .json({ message: 'Validation failed', data: errors.array() });
    }

    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const u = await (User as any).findById(userId);
    if (!u) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, u.password);
    if (!ok)
      return res.status(401).json({ message: 'Current password is incorrect' });

    u.password = await bcrypt.hash(newPassword, 12);
    await u.save();

    return res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
}

const authController = {
  signup,
  login,
  logout,
  getUser,
  updateMe,
  updatePassword,
};

export default authController;
