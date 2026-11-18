// SEO: a sitemap built from live listings, so search engines find every property page.
// The frontend (Vercel) forwards /sitemap.xml here – see client/vercel.json.
import { Router } from 'express';
import { env } from '../config/env.js';
import { Property } from '../models/Property.js';

const router = Router();

const xmlEscape = (text: string) => text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

let cache: { xml: string; createdAt: number } | null = null;
const CACHE_MS = 10 * 60 * 1000;

router.get('/sitemap.xml', async (_req, res) => {
  if (!cache || Date.now() - cache.createdAt > CACHE_MS) {
    const properties = await Property.find({ status: 'active' }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(45_000).lean();
    const staticPages = ['/', '/properties', '/properties?purpose=sale', '/properties?purpose=rent'];

    const urls = [
      ...staticPages.map((path) => `  <url><loc>${xmlEscape(env.SITE_URL + path)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`),
      ...properties.map(
        (p) =>
          `  <url><loc>${xmlEscape(`${env.SITE_URL}/properties/${p._id}`)}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`
      ),
    ];
    cache = {
      xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
      createdAt: Date.now(),
    };
  }
  res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(cache.xml);
});

// The API itself should not appear in search results
router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /api/\n');
});

export default router;
