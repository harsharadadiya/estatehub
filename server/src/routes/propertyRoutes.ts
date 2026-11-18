import { Router } from 'express';
import {
  createProperty,
  deleteProperty,
  getAvailableSlots,
  getProperty,
  getSimilarProperties,
  listCities,
  listProperties,
  updateProperty,
} from '../controllers/propertyController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { propertyImagesUpload } from '../middleware/upload.js';
import { validateObjectId, validateQuery } from '../middleware/validate.js';
import { propertyQuerySchema } from '../validators/schemas.js';

const router = Router();

// Public (login optional)
router.get('/', validateQuery(propertyQuerySchema), listProperties);
router.get('/cities', listCities);
router.get('/:id', validateObjectId(), optionalAuth, getProperty);
router.get('/:id/similar', validateObjectId(), optionalAuth, getSimilarProperties);
router.get('/:id/slots', validateObjectId(), getAvailableSlots);

// Logged-in users manage their own listings (ownership is checked in the controller)
router.post('/', requireAuth, propertyImagesUpload, createProperty);
router.patch('/:id', requireAuth, validateObjectId(), propertyImagesUpload, updateProperty);
router.delete('/:id', requireAuth, validateObjectId(), deleteProperty);

export default router;
