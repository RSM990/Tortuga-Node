const express = require('express');
const { body } = require('express-validator');
const User = require('../models/user');
const authController = require('../controllers/auth');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/me', isAuth, authController.getUser);

router.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .custom((value) =>
        User.findOne({ email: value }).then((u) => {
          if (u) return Promise.reject('E-mail address already exists!');
        })
      )
      .normalizeEmail(),
    body('password').trim().isLength({ min: 5 }),
    body('firstName').trim().not().isEmpty(),
    body('lastName').trim().not().isEmpty(),
  ],
  authController.signup
);

router.post('/login', authController.login);

// NEW
router.post('/logout', isAuth, authController.logout);

router.patch(
  '/me',
  isAuth,
  [
    body('firstName').optional().trim().isLength({ min: 1 }),
    body('lastName').optional().trim().isLength({ min: 1 }),
  ],
  authController.updateMe
);

router.patch(
  '/password',
  isAuth,
  [
    body('currentPassword').isString().isLength({ min: 5 }),
    body('newPassword').isString().isLength({ min: 5 }),
  ],
  authController.updatePassword
);

module.exports = router;
