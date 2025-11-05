import { Router } from 'express';
import MovieOwnership from '../models/movieOwnership';
import { enforceAcquisitionWindow } from '../middleware/enforceAcquisitionWindow';

const router = Router();

router.post('/', enforceAcquisitionWindow, async (req, res, next) => {
  try {
    const ow = await MovieOwnership.create(req.body);
    res.status(201).json(ow);
  } catch (e) {
    next(e);
  }
});

router.get('/by-season/:seasonId', async (req, res, next) => {
  try {
    const items = await MovieOwnership.find({ seasonId: req.params.seasonId });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

export default router;
