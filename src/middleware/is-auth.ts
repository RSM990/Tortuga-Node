import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import logger from '../config/logger.js';

// Single source of truth for the secret
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'somesupersecretsecret';

// Narrow the decoded payload to what we sign in authController
type AuthTokenPayload = JwtPayload & {
  userId?: string;
  email?: string;
};

const isAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Cookie is set by auth controller as "token"
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as AuthTokenPayload;

    // Validate expected field
    if (!decoded?.userId) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }

    req.userId = decoded.userId;
    return next();
  } catch (err: any) {
    // Common jwt errors: TokenExpiredError, JsonWebTokenError, NotBeforeError
    logger.error('JWT Error', { error: err?.message || err });
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export default isAuth;
