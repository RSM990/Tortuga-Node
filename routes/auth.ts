// src/routes/auth.ts
import { Router } from 'express';
import { body } from 'express-validator';

import User from '../models/User.js'; // make sure filename/casing matches
import authController from '../controllers/auth.js'; // default export with handlers
import isAuth from '../middleware/is-auth.js'; // default export middleware

const router = Router();

// GET /api/auth/me
router.get('/me', isAuth, authController.getUser);

// POST /api/auth/signup
router.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .bail()
      .custom(async (value) => {
        const u = await User.findOne({ email: value }).lean();
        if (u) {
          // express-validator expects a thrown Error or rejected Promise
          throw new Error('E-mail address already exists!');
        }
      })
      .normalizeEmail(),
    body('password').isString().trim().isLength({ min: 5 }),
    body('firstName').isString().trim().notEmpty(),
    body('lastName').isString().trim().notEmpty(),
  ],
  authController.signup
);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/logout
router.post('/logout', isAuth, authController.logout);

// PATCH /api/auth/me
router.patch(
  '/me',
  isAuth,
  [
    body('firstName').optional().isString().trim().isLength({ min: 1 }),
    body('lastName').optional().isString().trim().isLength({ min: 1 }),
  ],
  authController.updateMe
);

// PATCH /api/auth/password
router.patch(
  '/password',
  isAuth,
  [
    body('currentPassword').isString().isLength({ min: 5 }),
    body('newPassword').isString().isLength({ min: 5 }),
  ],
  authController.updatePassword
);

/**
 * GET /api/auth/check-email?email=foo@bar.com
 * Returns: { available: boolean }
 */
router.get('/check-email', async (req, res) => {
  const raw = String(req.query.email || '')
    .trim()
    .toLowerCase();
  if (!raw)
    return res.status(400).json({ available: false, reason: 'missing-email' });

  try {
    const exists = await User.exists({ email: raw });
    return res.json({ available: !exists });
  } catch (err) {
    // Fail-open is OK for UX; log for ops
    console.error('check-email error', err);
    return res.status(200).json({ available: true });
  }
});

export default router;
