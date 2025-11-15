// src/controllers/auth.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  HttpStatus,
  sendSuccessResponse,
  sendErrorResponse,
  successResponse,
} from '../utils/response.js';

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

const getReqUserId = (req: Request): string | undefined =>
  (req as any).userId as string | undefined;

/**
 * Register new user
 * POST /api/auth/signup
 */
async function signup(req: Request, res: Response) {
  try {
    // ✅ VALIDATION ERRORS
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(
        res,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Validation failed',
        errors.array().map((err: any) => ({
          field: err.path || err.param,
          message: err.msg,
          code: 'VALIDATION_ERROR',
        }))
      );
    }

    const { email, password, firstName, lastName } = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };

    // Check if user already exists
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return sendErrorResponse(
        res,
        HttpStatus.CONFLICT,
        'Email already registered'
      );
    }

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

    // ✅ CREATED RESPONSE (201)
    return res
      .status(HttpStatus.CREATED)
      .json(
        successResponse(
          { token, user: makeSafeUser(result) },
          undefined,
          'Account created successfully'
        )
      );
  } catch (err) {
    console.error('Error during signup:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create account'
    );
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const u = await (User as any).findOne({ email });

    // ✅ NOT FOUND OR INVALID CREDENTIALS
    if (!u) {
      return sendErrorResponse(
        res,
        HttpStatus.UNAUTHORIZED,
        'Invalid email or password'
      );
    }

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) {
      return sendErrorResponse(
        res,
        HttpStatus.UNAUTHORIZED,
        'Invalid email or password'
      );
    }

    const token = jwt.sign(
      { userId: String(u._id), email: u.email },
      SESSION_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, cookieOptionsForEnv());

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(
      res,
      { token, user: makeSafeUser(u) },
      'Login successful'
    );
  } catch (err) {
    console.error('Error during login:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to login'
    );
  }
}

/**
 * Logout user
 * POST /api/auth/logout
 */
async function logout(_req: Request, res: Response) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const clearOpts: CookieOptions = {
      path: '/',
      ...(isProd
        ? { domain: '.tortugatest.com', sameSite: 'none', secure: true }
        : {}),
    };
    res.clearCookie('token', clearOpts);

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, null, 'Logout successful');
  } catch (err) {
    console.error('Error during logout:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to logout'
    );
  }
}

/**
 * Get current user
 * GET /api/auth/me
 */
async function getUser(req: Request, res: Response) {
  try {
    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const u = await User.findById(userId);

    // ✅ NOT FOUND CHECK
    if (!u) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'User not found');
    }

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, makeSafeUser(u));
  } catch (err) {
    console.error('Error fetching user:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch user'
    );
  }
}

/**
 * Update user profile
 * PATCH /api/auth/me
 */
async function updateMe(req: Request, res: Response) {
  try {
    // ✅ VALIDATION ERRORS
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(
        res,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Validation failed',
        errors.array().map((err: any) => ({
          field: err.path || err.param,
          message: err.msg,
          code: 'VALIDATION_ERROR',
        }))
      );
    }

    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { firstName, lastName } = req.body as {
      firstName?: string;
      lastName?: string;
    };

    const u = await (User as any).findById(userId);

    // ✅ NOT FOUND CHECK
    if (!u) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'User not found');
    }

    if (typeof firstName === 'string' && firstName.trim())
      u.firstName = firstName.trim();
    if (typeof lastName === 'string' && lastName.trim())
      u.lastName = lastName.trim();
    await u.save();

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(
      res,
      makeSafeUser(u),
      'Profile updated successfully'
    );
  } catch (err) {
    console.error('Error updating profile:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update profile'
    );
  }
}

/**
 * Update password
 * PATCH /api/auth/password
 */
async function updatePassword(req: Request, res: Response) {
  try {
    // ✅ VALIDATION ERRORS
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(
        res,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Validation failed',
        errors.array().map((err: any) => ({
          field: err.path || err.param,
          message: err.msg,
          code: 'VALIDATION_ERROR',
        }))
      );
    }

    // ✅ AUTH CHECK
    const userId = getReqUserId(req);
    if (!userId) {
      return sendErrorResponse(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const u = await (User as any).findById(userId);

    // ✅ NOT FOUND CHECK
    if (!u) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'User not found');
    }

    const ok = await bcrypt.compare(currentPassword, u.password);

    // ✅ INVALID CREDENTIALS
    if (!ok) {
      return sendErrorResponse(
        res,
        HttpStatus.UNAUTHORIZED,
        'Current password is incorrect'
      );
    }

    u.password = await bcrypt.hash(newPassword, 12);
    await u.save();

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, null, 'Password updated successfully');
  } catch (err) {
    console.error('Error updating password:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update password'
    );
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
