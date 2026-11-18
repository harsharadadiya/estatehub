import { Router } from 'express';
import { forgotPassword, login, register, resetPassword } from '../controllers/authController.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiters.js';
import { validateBody } from '../middleware/validate.js';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../validators/schemas.js';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/forgot-password', passwordResetLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), resetPassword);

export default router;
