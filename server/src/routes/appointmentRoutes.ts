import { Router } from 'express';
import {
  cancelGuestAppointment,
  createGuestAppointment,
  createUserAppointment,
  getGuestAppointment,
  getMyAppointments,
  getReceivedAppointments,
  updateAppointmentStatus,
} from '../controllers/appointmentController.js';
import { requireAuth } from '../middleware/auth.js';
import { guestBookingLimiter } from '../middleware/rateLimiters.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { appointmentStatusSchema, guestAppointmentSchema, guestCancelSchema, userAppointmentSchema } from '../validators/schemas.js';

const router = Router();

// Guest route (no account)
router.post('/guest', guestBookingLimiter, validateBody(guestAppointmentSchema), createGuestAppointment);
router.get('/:id/guest', validateObjectId(), getGuestAppointment);
router.post('/:id/guest-cancel', guestBookingLimiter, validateObjectId(), validateBody(guestCancelSchema), cancelGuestAppointment);

// Logged-in routes
router.post('/', requireAuth, validateBody(userAppointmentSchema), createUserAppointment);
router.get('/mine', requireAuth, getMyAppointments);
router.get('/received', requireAuth, getReceivedAppointments);
router.patch('/:id/status', requireAuth, validateObjectId(), validateBody(appointmentStatusSchema), updateAppointmentStatus);

export default router;
