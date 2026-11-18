/**
 * AI PROPERTY HUB (optional bonus module, behind the AI_HUB_ENABLED feature flag)
 *
 * Pipeline:
 *  1. Our own live listings that match the search (from MongoDB)
 *  2. Firecrawl SEARCH on Indian property portals → listing URLs
 *  3. Deduplicate + drop rentals in code
 *  4. Firecrawl SCRAPE each listing page (with retry + backoff)
 *  5. Claude reads everything and ranks it (falls back to rule-based ranking without a key)
 */
import { env } from '../../config/env.js';
import { Property } from '../../models/Property.js';
import { AppError } from '../../utils/AppError.js';
import { escapeRegex, formatINR } from '../../utils/format.js';
import type { AiSearchInput } from '../../validators/schemas.js';
import { isClaudeConfigured, rankWithClaude, type AiRanking, type RankCandidate } from './claudeRanker.js';
import { createFirecrawlClient, type SearchHit } from './firecrawl.js';
import { dedupe, looksLikeRental, parseArea, parseBedrooms, parseIndianPrice, PORTALS, ruleBasedScore, sourceLabelFor } from './listingText.js';
import type { RetryStats } from './retry.js';

export function isAiHubAvailable(): boolean {
  return env.AI_HUB_ENABLED;
}

export interface HubResult {
  id: string;
  source: string; // "EstateHub", "99acres", "MagicBricks", …
  isPlatform: boolean;
  propertyId: string | null; // our own listing id
  url: string;
  title: string;
  priceInr: number | null;
  priceText: string | null;
  bedrooms: number | null;
  areaSqft: number | null;
  locality: string | null;
  image: string | null;
  score: number;
  reasons: string[];
}

export interface HubResponse {
  results: HubResult[];
  meta: {
    rankedBy: 'ai' | 'rules';
    usedWebSources: boolean;
    retries: number;
    retryLog: string[];
    removedRentals: number;
    removedDuplicates: number;
    durationMs: number;
    warnings: string[];
  };
}

interface Candidate extends RankCandidate {
  isPlatform: boolean;
  propertyId: string | null;
  image: string | null;
  price: number | null;
  bedrooms: number | null;
  area: number | null;
  locality: string | null;
  type: string | null;
}

const PROPERTY_WORD: Record<AiSearchInput['propertyType'], string> = {
  any: 'flat',
  apartment: 'apartment flat',
  'independent-house': 'independent house',
  villa: 'villa',
  plot: 'plot',
};

function buildSearchQuery(input: AiSearchInput): string {
  return [
    input.bedrooms ? `${input.bedrooms} BHK` : '',
    PROPERTY_WORD[input.propertyType],
    'for sale in',
    input.locality,
    input.city,
    input.maxBudget ? `under ${formatINR(input.maxBudget).replace('₹', '')}` : '',
    input.query,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 400);
}

/** Step 1: matching listings from our own database (always for sale – the hub is for buyers) */
async function platformCandidates(input: AiSearchInput): Promise<Candidate[]> {
  const city = new RegExp(escapeRegex(input.city), 'i');
  const price: Record<string, number> = {};
  if (input.maxBudget) price.$lte = input.maxBudget * 1.2; // a little flexibility, the ranking decides
  if (input.minBudget) price.$gte = input.minBudget * 0.8;

  const listings = await Property.find({
    status: 'active',
    purpose: 'sale',
    'location.city': city,
    ...(input.propertyType !== 'any' && { type: input.propertyType }),
    ...(Object.keys(price).length && { price }),
  })
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  return listings.map((p) => ({
    id: `platform:${p._id}`,
    source: 'EstateHub',
    isPlatform: true,
    propertyId: String(p._id),
    title: p.title,
    url: `${env.SITE_URL}/properties/${p._id}`,
    image: p.images[0]?.url ?? null,
    price: p.price,
    bedrooms: p.bedrooms,
    area: p.area,
    locality: p.location.locality,
    type: p.type,
    text: `${p.title}. ${p.bedrooms} BHK ${p.type}, ${p.area} sq ft, ${formatINR(p.price)}, ${p.furnishing}, ${p.location.locality}, ${p.location.city}. Amenities: ${p.amenities.join(', ')}. ${p.description.slice(0, 600)}`,
  }));
}

export async function runAiSearch(
  input: AiSearchInput,
  options: { firecrawlKey: string; simulateRateLimits: number }
): Promise<HubResponse> {
  const started = Date.now();
  const stats: RetryStats = { retries: 0, log: [] };
  const warnings: string[] = [];
  let removedRentals = 0;
  let removedDuplicates = 0;

  const candidates: Candidate[] = await platformCandidates(input);

  // ---------- Steps 2–4: live listings from property portals ----------
  if (options.firecrawlKey) {
    const firecrawl = createFirecrawlClient({ apiKey: options.firecrawlKey, stats, simulateRateLimits: options.simulateRateLimits });
    const hits = await firecrawl.search(buildSearchQuery(input), {
      limit: Math.min(20, input.maxResults * 2 + 4),
      includeDomains: Object.keys(PORTALS),
      location: `${input.city},India`,
    });

    const unique: SearchHit[] = dedupe(hits);
    removedDuplicates += hits.length - unique.length;
    const forSale = unique.filter((hit) => !looksLikeRental(hit.url, hit.title, hit.description));
    removedRentals += unique.length - forSale.length;

    // Scrape 2 pages at a time (friendly to rate limits)
    const toScrape = forSale.slice(0, input.maxResults);
    for (let i = 0; i < toScrape.length; i += 2) {
      const batch = await Promise.allSettled(toScrape.slice(i, i + 2).map((hit) => firecrawl.scrape(hit.url)));
      batch.forEach((outcome, j) => {
        const hit = toScrape[i + j]!;
        if (outcome.status === 'rejected') {
          if (outcome.reason instanceof AppError && outcome.reason.statusCode !== 503) throw outcome.reason; // bad key / no credits
          warnings.push(`Could not read ${sourceLabelFor(hit.url)} page – skipped`);
          return;
        }
        const page = outcome.value;
        const text = `${hit.title}\n${hit.description}\n${page.markdown}`.slice(0, 3500);
        if (looksLikeRental(page.title)) {
          removedRentals += 1;
          return;
        }
        candidates.push({
          id: `web:${candidates.length}`,
          source: sourceLabelFor(hit.url),
          isPlatform: false,
          propertyId: null,
          title: hit.title || page.title || 'Property listing',
          url: hit.url,
          image: page.image,
          price: parseIndianPrice(`${hit.title} ${hit.description} ${page.markdown.slice(0, 1500)}`),
          bedrooms: parseBedrooms(`${hit.title} ${hit.description}`),
          area: parseArea(text),
          locality: null,
          type: null,
          text,
        });
      });
    }
  } else {
    warnings.push('Add your Firecrawl API key (AI Hub settings) to include live listings from property portals.');
  }

  if (candidates.length === 0) {
    return {
      results: [],
      meta: { rankedBy: 'rules', usedWebSources: Boolean(options.firecrawlKey), retries: stats.retries, retryLog: stats.log, removedRentals, removedDuplicates, durationMs: Date.now() - started, warnings },
    };
  }

  // ---------- Step 5: rank ----------
  let rankings: Map<string, AiRanking> | null = null;
  if (isClaudeConfigured()) {
    try {
      const ranked = await rankWithClaude(
        input,
        candidates.map(({ id, source, title, url, text }) => ({ id, source, title, url, text }))
      );
      rankings = new Map(ranked.map((r) => [r.id, r]));
    } catch (error) {
      console.error('AI ranking failed – using rule-based ranking:', (error as Error).message);
      warnings.push('AI ranking was unavailable, so results were ranked with simple rules.');
    }
  } else {
    warnings.push('AI model key not set – results are ranked with simple rules.');
  }

  const results: HubResult[] = [];
  for (const c of candidates) {
    const ai = rankings?.get(c.id);
    if (ai && ai.isRental) {
      removedRentals += 1;
      continue;
    }
    if (ai && !ai.isListingPage && !c.isPlatform) continue; // search/category pages are not single listings

    const price = c.price ?? ai?.priceInr ?? null;
    const bedrooms = c.bedrooms ?? ai?.bedrooms ?? null;
    const rule = ruleBasedScore(input, { price, bedrooms, text: c.text, type: c.type });

    results.push({
      id: c.id,
      source: c.source,
      isPlatform: c.isPlatform,
      propertyId: c.propertyId,
      url: c.url,
      title: (c.isPlatform ? c.title : ai?.title || c.title).slice(0, 120),
      priceInr: price,
      priceText: price ? formatINR(price) : null,
      bedrooms,
      areaSqft: c.area ?? ai?.areaSqft ?? null,
      locality: c.locality ?? ai?.locality ?? null,
      image: c.image,
      score: ai?.score ?? rule.score,
      reasons: (ai?.reasons?.length ? ai.reasons : rule.reasons).slice(0, 3),
    });
  }

  results.sort((a, b) => b.score - a.score || Number(b.isPlatform) - Number(a.isPlatform));

  return {
    results: results.slice(0, 12),
    meta: {
      rankedBy: rankings ? 'ai' : 'rules',
      usedWebSources: Boolean(options.firecrawlKey),
      retries: stats.retries,
      retryLog: stats.log,
      removedRentals,
      removedDuplicates,
      durationMs: Date.now() - started,
      warnings,
    },
  };
}
