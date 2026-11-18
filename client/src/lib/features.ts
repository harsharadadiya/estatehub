// Feature flags (set in client/.env or in Vercel). Optional modules can be switched off without code changes.
export const features = {
  /** Optional bonus module: AI Property Hub. The API also needs AI_HUB_ENABLED=true. */
  aiHub: import.meta.env.VITE_ENABLE_AI_HUB === 'true',
};

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin).replace(/\/$/, '');
