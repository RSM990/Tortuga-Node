// src/validators/index.ts
import { body, param, query } from 'express-validator';

/**
 * Common validators
 */
export const objectIdValidator = (field: string) =>
  param(field)
    .isMongoId()
    .withMessage(`${field} must be a valid MongoDB ObjectId`);

/**
 * Auth validators
 */
export const signupValidation = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('password')
    .isString()
    .trim()
    .isLength({ min: 5 })
    .withMessage('Password must be at least 5 characters'),
  body('firstName')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
];

export const updateUserValidation = [
  body('firstName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name must not be empty'),
  body('lastName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name must not be empty'),
];

export const updatePasswordValidation = [
  body('currentPassword')
    .isString()
    .isLength({ min: 5 })
    .withMessage('Current password is required'),
  body('newPassword')
    .isString()
    .isLength({ min: 5 })
    .withMessage('New password must be at least 5 characters'),
];

/**
 * League validators
 */
export const createLeagueValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('League name is required (1-100 characters)'),
  body('visibility')
    .optional()
    .isIn(['private', 'unlisted', 'public'])
    .withMessage('Visibility must be private, unlisted, or public'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a valid IANA timezone string'),
  body('budgetCap')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Budget cap must be a positive integer'),
  body('pointsScheme')
    .optional()
    .isIn(['optionB', 'custom'])
    .withMessage('Points scheme must be optionB or custom'),
];

export const updateLeagueValidation = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('League name must be 1-100 characters'),
  body('visibility')
    .optional()
    .isIn(['private', 'unlisted', 'public'])
    .withMessage('Visibility must be private, unlisted, or public'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a valid IANA timezone string'),
  body('budgetCap')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Budget cap must be a positive integer'),
];

/**
 * Season validators
 */
export const createSeasonValidation = [
  body('leagueId')
    .isMongoId()
    .withMessage('League ID must be a valid MongoDB ObjectId'),
  body('label')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Season label is required (1-50 characters)'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('weekCount')
    .isInt({ min: 1, max: 52 })
    .withMessage('Week count must be between 1 and 52'),
];

/**
 * Studio validators
 */
export const createStudioValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Studio name is required (1-100 characters)'),
];

export const updateStudioValidation = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Studio name must be 1-100 characters'),
];

/**
 * Ownership validators
 */
export const createOwnershipValidation = [
  body('leagueId')
    .isMongoId()
    .withMessage('League ID must be a valid MongoDB ObjectId'),
  body('seasonId')
    .isMongoId()
    .withMessage('Season ID must be a valid MongoDB ObjectId'),
  body('studioId')
    .isMongoId()
    .withMessage('Studio ID must be a valid MongoDB ObjectId'),
  body('movieId')
    .isMongoId()
    .withMessage('Movie ID must be a valid MongoDB ObjectId'),
  body('purchasePrice')
    .isFloat({ min: 0 })
    .withMessage('Purchase price must be a non-negative number'),
  body('acquiredAt')
    .isISO8601()
    .withMessage('Acquired date must be a valid ISO 8601 date'),
];

/**
 * Award validators
 */
export const applyAwardBonusValidation = [
  body('categoryKey')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Category key is required'),
  body('movieId')
    .isMongoId()
    .withMessage('Movie ID must be a valid MongoDB ObjectId'),
  body('result')
    .isIn(['nom', 'win'])
    .withMessage('Result must be either "nom" or "win"'),
];

/**
 * Compute validators
 */
export const computeWeekValidation = [
  param('id')
    .isMongoId()
    .withMessage('Season ID must be a valid MongoDB ObjectId'),
  param('weekIndex')
    .isInt({ min: 0 })
    .withMessage('Week index must be a non-negative integer'),
];

/**
 * Movie validators
 */
export const movieValidation = [
  body('title')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Title is required'),
  body('releaseDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Release date must be an ISO date'),
  body('director')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Director must be at least 3 characters'),
  body('genres')
    .optional({ nullable: true })
    .isArray()
    .withMessage('Genres must be an array of strings'),
  body('genres.*')
    .optional({ nullable: true })
    .isString()
    .trim(),
  body('runtimeMin')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Runtime must be a positive integer'),
];

/**
 * Dev validators
 */
export const devRevenueUpsertValidation = [
  body('movieId')
    .isMongoId()
    .withMessage('Movie ID must be a valid MongoDB ObjectId'),
  body('weekStart')
    .isISO8601()
    .withMessage('Week start must be a valid ISO 8601 date'),
  body('weekEnd')
    .isISO8601()
    .withMessage('Week end must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.weekStart)) {
        throw new Error('Week end must be after week start');
      }
      return true;
    }),
  body('domesticGross')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Domestic gross must be a non-negative number'),
  body('worldwideGross')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Worldwide gross must be a non-negative number'),
];
