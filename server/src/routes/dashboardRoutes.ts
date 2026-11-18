import { Router } from 'express';
import { getMyProperties, getSummary } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth); // the dashboard is only for logged-in users

router.get('/summary', getSummary);
router.get('/properties', getMyProperties);

export default router;
