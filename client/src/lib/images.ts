import { API_ORIGIN } from './api';

/**
 * Returns a usable image URL.
 *  • ImageKit images get an on-the-fly resize (?tr=w-800) so phones download small files.
 *  • Local development images (/uploads/...) are loaded from the API server.
 */
export function imageUrl(url: string | undefined | null, width?: number): string {
  if (!url) return '';
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  if (width && url.includes('ik.imagekit.io')) {
    return `${url}${url.includes('?') ? '&' : '?'}tr=w-${width},q-75`;
  }
  return url;
}
