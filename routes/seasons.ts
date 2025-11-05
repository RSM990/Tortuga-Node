import { Router } from 'express';
import Season from '../models/season';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const season = await Season.create(req.body);
    res.status(201).json(season);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const season = await Season.findById(req.params.id);
    if (!season) return res.status(404).json({ message: 'Not found' });
    res.json(season);
  } catch (e) {
    next(e);
  }
});

export default router;
