import { Router } from 'express';
import { changePassword, deleteMe, getMe, updateMe } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { validateBody } from '../middleware/validate.js';
import { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/me', getMe);
router.patch('/me', validateBody(updateProfileSchema), updateMe);
router.patch('/me/password', authLimiter, validateBody(changePasswordSchema), changePassword);
router.delete('/me', authLimiter, validateBody(deleteAccountSchema), deleteMe);

export default router;
