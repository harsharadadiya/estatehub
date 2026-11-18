// Reads settings from .env and checks them with Zod.
// If something important is missing, the server stops with a clear message.
import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((value) => ['true', '1', 'yes', 'on'].includes((value ?? '').trim().toLowerCase()));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required (your MongoDB Atlas connection string)'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters (32+ in production)'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    CLIENT_URL: z.string().default('http://localhost:5173'),

    SMTP_HOST: z.string().optional().default(''),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: bool,
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    EMAIL_FROM: z.string().default('EstateHub <no-reply@example.com>'),

    IMAGEKIT_PRIVATE_KEY: z.string().optional().default(''),
    IMAGEKIT_FOLDER: z.string().default('/estatehub/properties'),
    // Advanced: only change these to point at a test/mock server
    IMAGEKIT_UPLOAD_URL: z.string().default('https://upload.imagekit.io/api/v1/files/upload'),
    IMAGEKIT_API_URL: z.string().default('https://api.imagekit.io/v1'),

    AI_HUB_ENABLED: bool,
    ANTHROPIC_API_KEY: z.string().optional().default(''),
    AI_MODEL: z.string().default('claude-haiku-5-5'),
    FIRECRAWL_API_KEY: z.string().optional().default(''),
    FIRECRAWL_API_URL: z.string().default('https://api.firecrawl.dev'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.length < 32) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Use at least 32 characters in production' });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid environment settings:');
  for (const issue of parsed.error.issues) console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
  console.error('\n   Copy server/.env.example to server/.env and fill in the values.\n');
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  CLIENT_URLS: data.CLIENT_URL.split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean),
  /** First CLIENT_URL – used to build links in emails and the sitemap */
  SITE_URL: data.CLIENT_URL.split(',')[0]!.trim().replace(/\/$/, ''),
  isProduction: data.NODE_ENV === 'production',
  emailConfigured: Boolean(data.SMTP_HOST),
  storageDriver: data.IMAGEKIT_PRIVATE_KEY ? ('imagekit' as const) : ('local' as const),
};
