import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Writes robots.txt at build time with your real site address (VITE_SITE_URL),
 * so search engines can find the sitemap.
 */
function robotsTxt(siteUrl: string): Plugin {
  return {
    name: 'robots-txt',
    apply: 'build',
    generateBundle() {
      const base = siteUrl.replace(/\/$/, '');
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /reset-password\nDisallow: /appointments/\n\nSitemap: ${base}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173';
  // Where the Express API runs during development (change it if you use another port)
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss(), robotsTxt(siteUrl)],
    resolve: {
      // "@/components/ui/button" instead of "../../components/ui/button"
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // In development, API calls go through Vite to the Express server (no CORS problems)
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
        '/sitemap.xml': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Separate, cacheable bundles for the big libraries
          manualChunks(id) {
            if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) return 'mui';
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
