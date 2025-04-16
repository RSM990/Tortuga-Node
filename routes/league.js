const express = require('express');
const { body } = require('express-validator');

const leagueController = require('../controllers/league');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.post(
  '/',
  isAuth,
  [body('name').trim().isLength({ min: 3 })],
  leagueController.createLeague
);

module.exports = router;
