// Builds the Express app: security, parsing, logging, routes and error handling.
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { isDbConnected } from './config/db.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { AMENITIES, FURNISHING, MAX_IMAGES, PROPERTY_TYPES } from './models/Property.js';
import aiRoutes from './routes/aiRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import realtimeRoutes from './routes/realtimeRoutes.js';
import seoRoutes from './routes/seoRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { UPLOAD_DIR } from './services/storage.js';
import { AppError } from './utils/AppError.js';
import { VIEWING_SLOTS } from './utils/dates.js';
import { isAiHubAvailable } from './services/ai/aiHub.js';

export function createApp() {
  const app = express();

  // Render / Vercel sit behind a proxy: trust it so rate limiting sees the real visitor IP
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---------- Security ----------
  app.use(
    helmet({
      // Allow the frontend (another domain) to show images from /uploads
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        // No origin = curl / Postman / server-to-server. Otherwise only our own frontend(s).
        if (!origin || env.CLIENT_URLS.includes(origin)) return callback(null, true);
        return callback(new AppError(`CORS: ${origin} is not allowed. Add it to CLIENT_URL in server/.env`, 403));
      },
      exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
    })
  );

  // ---------- Parsing & logging ----------
  // Compress responses, but never the live-updates stream (it must reach the browser immediately)
  app.use(compression({ filter: (req, res) => !req.path.startsWith('/api/realtime') && compression.filter(req, res) }));
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // ---------- Public files ----------
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));
  app.use(seoRoutes); // /sitemap.xml

  // ---------- API ----------
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: isDbConnected() ? 'connected' : 'disconnected', time: new Date().toISOString() });
  });

  // Public settings the frontend needs (no secrets!)
  app.get('/api/config', (_req, res) => {
    res.json({
      propertyTypes: PROPERTY_TYPES,
      furnishing: FURNISHING,
      amenities: AMENITIES,
      maxImages: MAX_IMAGES,
      viewingSlots: VIEWING_SLOTS,
      storage: env.storageDriver,
      aiHub: isAiHubAvailable(),
    });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/realtime', realtimeRoutes);
  app.use('/api/ai', aiRoutes);

  // ---------- 404 + errors (must be last) ----------
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
