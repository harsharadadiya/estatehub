// Multer receives "multipart/form-data" uploads.
// Files are kept in memory (max 4 × 5 MB) and then sent to ImageKit (or the uploads folder).
import multer from 'multer';
import { MAX_IMAGES } from '../models/Property.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const propertyImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_IMAGES, fields: 10, fieldSize: 64 * 1024 },
  fileFilter(_req, file, callback) {
    if (ALLOWED_TYPES.has(file.mimetype)) callback(null, true);
    else callback(new AppError(`"${file.originalname}" is not allowed. Use JPG, PNG or WebP images.`, 400));
  },
}).array('images', MAX_IMAGES);
