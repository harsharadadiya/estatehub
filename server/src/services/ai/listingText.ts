// Small text helpers for listings found on the web: dedupe, rental filter, price/BHK/area parsing,
// and a rule-based score used when the AI model is not available.
import type { AiSearchInput } from '../../validators/schemas.js';

export const PORTALS: Record<string, string> = {
  '99acres.com': '99acres',
  'magicbricks.com': 'MagicBricks',
  'housing.com': 'Housing.com',
  'nobroker.in': 'NoBroker',
  'squareyards.com': 'Square Yards',
};

export function sourceLabelFor(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const match = Object.keys(PORTALS).find((domain) => host === domain || host.endsWith(`.${domain}`));
    return match ? PORTALS[match]! : host;
  } catch {
    return 'Web';
  }
}

/** Same page, different tracking parameters → same key */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref|src|source|gclid|fbclid)/i.test(key)) u.searchParams.delete(key);
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Removes repeats: the same URL, or the same title on the same portal */
export function dedupe<T extends { url: string; title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const urlKey = normalizeUrl(item.url);
    const cleanTitle = item.title.toLowerCase().replace(/\s+/g, ' ').trim();
    const titleKey = cleanTitle ? `${sourceLabelFor(item.url)}|${cleanTitle}` : null;
    if (seen.has(urlKey) || (titleKey && seen.has(titleKey))) return false;
    seen.add(urlKey);
    if (titleKey) seen.add(titleKey);
    return true;
  });
}

const RENTAL_PATTERN = /\b(for rent|on rent|to rent|rental|per month|\/\s?month|monthly rent|lease|paying guest|\bpg\b|co-?living)\b|\/rent\/|-rent-|rent-in-/i;

export function looksLikeRental(...texts: string[]): boolean {
  return texts.some((t) => RENTAL_PATTERN.test(t));
}

/** "₹1.25 Cr", "85 Lac", "Rs. 75,00,000" → rupees */
export function parseIndianPrice(text: string): number | null {
  const crore = text.match(/(?:₹|rs\.?|inr)?\s*([\d.]+)\s*(?:cr|crore)s?\b/i);
  if (crore) return Math.round(Number(crore[1]) * 1e7) || null;
  const lakh = text.match(/(?:₹|rs\.?|inr)?\s*([\d.]+)\s*(?:l|lac|lacs|lakh|lakhs)\b/i);
  if (lakh) return Math.round(Number(lakh[1]) * 1e5) || null;
  const plain = text.match(/(?:₹|rs\.?|inr)\s*([\d,]{6,})/i);
  if (plain) return Number(plain[1]!.replace(/,/g, '')) || null;
  return null;
}

export function parseBedrooms(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:bhk|bed(?:room)?s?)\b/i);
  return m ? Number(m[1]) : null;
}

export function parseArea(text: string): number | null {
  const m = text.match(/([\d,]{3,7})\s*(?:sq\.?\s*ft|sqft|square\s*feet|sq\s*feet)/i);
  return m ? Number(m[1]!.replace(/,/g, '')) : null;
}

export interface RuleScore {
  score: number;
  reasons: string[];
}

/** Simple, explainable score (0–100) – the fallback when no AI model key is configured */
export function ruleBasedScore(
  input: AiSearchInput,
  listing: { price: number | null; bedrooms: number | null; text: string; type?: string | null }
): RuleScore {
  let score = 50;
  const reasons: string[] = [];
  const text = listing.text.toLowerCase();

  if (listing.price) {
    if (input.maxBudget && listing.price > input.maxBudget) {
      const over = (listing.price - input.maxBudget) / input.maxBudget;
      score -= Math.min(35, Math.round(over * 100));
      reasons.push(`About ${Math.round(over * 100)}% over your budget`);
    } else if (input.minBudget && listing.price < input.minBudget) {
      score -= 5;
      reasons.push('Below your minimum budget');
    } else if (input.maxBudget || input.minBudget) {
      score += 20;
      reasons.push('Within your budget');
    }
  } else {
    score -= 5;
    reasons.push('Price not listed');
  }

  if (input.bedrooms !== undefined && listing.bedrooms !== null) {
    if (listing.bedrooms === input.bedrooms) {
      score += 15;
      reasons.push(`${input.bedrooms} BHK as requested`);
    } else {
      score -= 8 * Math.abs(listing.bedrooms - input.bedrooms);
      reasons.push(`${listing.bedrooms} BHK (you asked for ${input.bedrooms})`);
    }
  }

  if (input.locality && text.includes(input.locality.toLowerCase())) {
    score += 10;
    reasons.push(`In ${input.locality}`);
  }
  if (input.propertyType !== 'any' && (listing.type === input.propertyType || text.includes(input.propertyType.replace('-', ' ')))) {
    score += 5;
  }
  const words = input.query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hits = words.filter((w) => text.includes(w));
  if (hits.length) {
    score += Math.min(10, hits.length * 3);
    reasons.push(`Mentions: ${hits.slice(0, 3).join(', ')}`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
