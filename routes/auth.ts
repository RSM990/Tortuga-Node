// src/routes/auth.ts
import { Router } from 'express';
import { body } from 'express-validator';

import User from '../models/user.js'; // make sure filename/casing matches
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

export default router;
