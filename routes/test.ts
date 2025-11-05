import { Router } from 'express';
import testController from '../controllers/test.js'; // default export expected

const router = Router();

router.get('/', testController.getTest);

export default router;
