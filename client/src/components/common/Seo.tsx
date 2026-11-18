// SEO tags for each page. React 19 moves <title>, <meta> and <link> into <head> automatically.
import { useLocation } from 'react-router-dom';
import { SITE_URL } from '@/lib/features';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  /** Pages like the dashboard should not appear in Google */
  noIndex?: boolean;
  /** Structured data for Google (schema.org JSON-LD) */
  jsonLd?: Record<string, unknown>;
}

const DEFAULT_DESCRIPTION = 'Buy or rent apartments, houses, villas and plots across India, listed directly by owners. Book a viewing in a few clicks.';

export function Seo({ title, description = DEFAULT_DESCRIPTION, image, noIndex, jsonLd }: SeoProps) {
  const { pathname, search } = useLocation();
  const url = `${SITE_URL}${pathname}${pathname === '/properties' ? search : ''}`;
  const fullTitle = title === 'EstateHub' ? 'EstateHub – Homes for sale and rent across India' : `${title} | EstateHub`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image} />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </>
  );
}
