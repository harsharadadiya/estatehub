// OPTIONAL BONUS MODULE – AI Property Hub (only included when VITE_ENABLE_AI_HUB=true)
// Searches live listings on property portals (Firecrawl) plus our own listings, and ranks them with AI.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import { ExternalLink, KeyRound, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, FormField, PageLoader, PasswordInput, SafeImage } from '@/components/common';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox, NativeSelect } from '@/components/ui/misc';
import { errorMessage, isApiError } from '@/lib/api';
import { formatArea, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { aiService, type AiSearchInput } from '@/services';
import type { HubResponse, HubResult } from '@/types';

const KEY_STORAGE = 'estatehub_firecrawl_key';
const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
};

const optionalAmount = z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().positive().optional());
const schema = z
  .object({
    city: z.string().trim().min(2, 'Enter a city'),
    locality: z.string().trim().max(80),
    propertyType: z.enum(['any', 'apartment', 'independent-house', 'villa', 'plot']),
    bedrooms: z.string(),
    minBudget: optionalAmount,
    maxBudget: optionalAmount,
    query: z.string().trim().max(300),
  })
  .refine((v) => !v.minBudget || !v.maxBudget || v.minBudget <= v.maxBudget, { message: 'Must be more than the minimum', path: ['maxBudget'] });
type Values = z.input<typeof schema>;

const BUDGETS = [2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000];
const LOADING_STEPS = ['Searching property portals…', 'Reading each listing page…', 'Removing repeats and rentals…', 'Ranking the best matches…'];

function KeySettings() {
  const [saved, setSaved] = useState(readKey);
  const [draft, setDraft] = useState('');

  function save() {
    const key = draft.trim();
    if (!/^fc-[A-Za-z0-9_-]{8,}$/.test(key)) return toast.error('A Firecrawl key starts with "fc-"');
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch {
      return toast.error('This browser blocks local storage, so the key cannot be saved');
    }
    setSaved(key);
    setDraft('');
    toast.success('Key saved in this browser');
  }

  function remove() {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* ignore */
    }
    setSaved('');
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="flex items-center gap-2 font-bold">
        <KeyRound className="size-4 text-primary" /> Your Firecrawl key
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Needed to search live portal listings. It stays in this browser and is sent only with your searches; our server never stores it.{' '}
        <a href="https://www.firecrawl.dev/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
          Get a free key
        </a>
      </p>
      {saved ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded bg-muted px-2 py-1 text-sm">
            {saved.slice(0, 5)}…{saved.slice(-4)}
          </code>
          <Button size="sm" variant="ghost" onClick={remove}>
            Remove key
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <PasswordInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="fc-..." aria-label="Firecrawl API key" autoComplete="off" />
          <Button onClick={save} disabled={!draft.trim()}>
            Save key
          </Button>
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, rank }: { result: HubResult; rank: number }) {
  const external = !result.isPlatform;
  const body = (
    <>
      <SafeImage src={result.image} width={400} alt="" className="h-40 w-full shrink-0 rounded-lg sm:h-28 sm:w-40" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-muted-foreground tabular">#{rank}</span>
          <Badge variant={result.isPlatform ? 'default' : 'outline'}>{result.source}</Badge>
          <span className="ml-auto flex items-center gap-2 text-sm font-semibold tabular" title="How well it matches your search">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${result.score}%` }} />
            </span>
            {result.score}% match
          </span>
        </div>
        <p className="font-bold group-hover:text-primary">{result.title}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {result.priceText ? <span className="price-tag text-sm">{result.priceText}</span> : <span className="text-muted-foreground">Price on request</span>}
          {result.bedrooms !== null && result.bedrooms > 0 && <span>{result.bedrooms} BHK</span>}
          {result.areaSqft && <span className="tabular">{formatArea(result.areaSqft)}</span>}
          {result.locality && <span className="text-muted-foreground">{result.locality}</span>}
        </div>
        {result.reasons.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {result.reasons.map((r) => (
              <li key={r} className="rounded-md bg-accent px-2 py-0.5 text-[13px] text-accent-foreground">
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
      {external && <ExternalLink className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-label="Opens the portal in a new tab" />}
    </>
  );
  const className = 'group flex flex-col gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 sm:flex-row';
  return (
    <li>
      {external ? (
        <a href={result.url} target="_blank" rel="noopener noreferrer nofollow" className={className}>
          {body}
        </a>
      ) : (
        <Link to={`/properties/${result.propertyId}`} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}

function SearchMeta({ meta }: { meta: HubResponse['meta'] }) {
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-muted-foreground">
        Ranked by {meta.rankedBy === 'ai' ? 'AI' : 'simple rules'} in {(meta.durationMs / 1000).toFixed(1)} s.{' '}
        {meta.removedDuplicates > 0 && `${meta.removedDuplicates} duplicate${meta.removedDuplicates > 1 ? 's' : ''} and `}
        {meta.removedRentals} rental{meta.removedRentals === 1 ? '' : 's'} removed.
      </p>
      {meta.retries > 0 && (
        <details className="rounded-lg border bg-card p-3">
          <summary className="cursor-pointer font-semibold">
            <RotateCcw className="mr-1.5 inline size-3.5" />
            Recovered from {meta.retries} temporary error{meta.retries > 1 ? 's' : ''} with automatic retries
          </summary>
          <ul className="mt-2 grid gap-1 font-mono text-xs text-muted-foreground">
            {meta.retryLog.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      )}
      {meta.warnings.map((w) => (
        <Alert key={w} severity="info">
          {w}
        </Alert>
      ))}
    </div>
  );
}

export default function AiHubPage() {
  const status = useQuery({ queryKey: ['ai-status'], queryFn: aiService.status, retry: false });
  const [simulate, setSimulate] = useState(false);
  const [step, setStep] = useState(0);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { city: '', locality: '', propertyType: 'apartment', bedrooms: '2', minBudget: '', maxBudget: '', query: '' },
  });
  const { errors } = form.formState;

  const search = useMutation({
    mutationFn: (values: z.output<typeof schema>) => {
      const input: AiSearchInput = {
        city: values.city,
        locality: values.locality || undefined,
        propertyType: values.propertyType,
        bedrooms: values.bedrooms === 'any' ? undefined : Number(values.bedrooms),
        minBudget: values.minBudget,
        maxBudget: values.maxBudget,
        query: values.query || undefined,
      };
      return aiService.search(input, { firecrawlKey: readKey() || undefined, simulateRateLimit: simulate ? 2 : 0 });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Move through the loading messages while the search runs
  useEffect(() => {
    if (!search.isPending) return setStep(0);
    const timer = window.setInterval(() => setStep((s) => Math.min(LOADING_STEPS.length - 1, s + 1)), 4000);
    return () => window.clearInterval(timer);
  }, [search.isPending]);

  if (status.isPending) return <PageLoader />;
  if (status.isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        {isApiError(status.error) && status.error.status === 404 ? (
          <EmptyState icon={Sparkles} title="AI search is switched off" description="The API has AI_HUB_ENABLED=false. The rest of EstateHub works normally." action={<Button asChild><Link to="/properties">Browse listings</Link></Button>} />
        ) : (
          <ErrorState error={status.error} onRetry={() => status.refetch()} />
        )}
      </div>
    );
  }

  const result = search.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Seo title="AI property search" description="Search live listings across Indian property portals and our own owners, ranked for your budget and needs." />
      <div className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold">
          <Sparkles className="size-7 text-marigold" aria-hidden="true" /> AI property search
        </h1>
        <p className="mt-2 text-muted-foreground">
          Describe the home you want to buy. We look at live listings on portals such as 99acres, MagicBricks and Housing.com plus homes listed on EstateHub, remove repeats and rentals, and rank what fits best.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <form
            onSubmit={form.handleSubmit((v) => search.mutate(v as z.output<typeof schema>))}
            className="grid gap-4 rounded-xl border bg-card p-5"
            noValidate
          >
            <FormField label="City" htmlFor="ai-city" error={errors.city?.message}>
              <Input id="ai-city" placeholder="e.g. Pune" aria-invalid={!!errors.city} {...form.register('city')} />
            </FormField>
            <FormField label="Locality (optional)" htmlFor="ai-locality">
              <Input id="ai-locality" placeholder="e.g. Baner" {...form.register('locality')} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type" htmlFor="ai-type">
                <NativeSelect id="ai-type" {...form.register('propertyType')}>
                  <option value="any">Any</option>
                  <option value="apartment">Flat</option>
                  <option value="independent-house">House</option>
                  <option value="villa">Villa</option>
                  <option value="plot">Plot</option>
                </NativeSelect>
              </FormField>
              <FormField label="Bedrooms" htmlFor="ai-bhk">
                <NativeSelect id="ai-bhk" {...form.register('bedrooms')}>
                  <option value="any">Any</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} BHK
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Min budget" htmlFor="ai-min">
                <NativeSelect id="ai-min" {...form.register('minBudget')}>
                  <option value="">No min</option>
                  {BUDGETS.map((b) => (
                    <option key={b} value={b}>
                      {formatPrice(b)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Max budget" htmlFor="ai-max" error={errors.maxBudget?.message}>
                <NativeSelect id="ai-max" {...form.register('maxBudget')}>
                  <option value="">No max</option>
                  {BUDGETS.map((b) => (
                    <option key={b} value={b}>
                      {formatPrice(b)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField label="Anything else? (optional)" htmlFor="ai-query" hint="e.g. near a metro station, east facing, gated society">
              <Input id="ai-query" maxLength={300} {...form.register('query')} />
            </FormField>
            {import.meta.env.DEV && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted p-3 text-sm">
                <Checkbox checked={simulate} onCheckedChange={(v) => setSimulate(v === true)} className="mt-0.5" />
                <span>
                  <b>Developer test:</b> pretend the first two portal requests hit a rate limit, to watch the automatic retry work.
                </span>
              </label>
            )}
            <Button type="submit" size="lg" loading={search.isPending}>
              <Sparkles /> Find and rank homes
            </Button>
          </form>
          <KeySettings />
          {!status.data.aiRanking && <p className="text-sm text-muted-foreground">AI ranking is not configured on the server, so results are ranked with simple rules.</p>}
        </div>

        <section aria-live="polite" aria-busy={search.isPending}>
          {search.isPending ? (
            <div className="rounded-xl border bg-card p-6">
              <p className="font-semibold">{LOADING_STEPS[step]}</p>
              <p className="mt-1 text-sm text-muted-foreground">Reading live pages takes 10 to 40 seconds.</p>
              <LinearProgress className="mt-4" />
            </div>
          ) : search.isError ? (
            <ErrorState error={search.error} onRetry={() => search.mutate(form.getValues() as z.output<typeof schema>)} />
          ) : result ? (
            <div className="grid gap-5">
              <SearchMeta meta={result.meta} />
              {result.results.length === 0 ? (
                <EmptyState title="No matching homes found" description="Try a bigger budget, another locality, or remove the bedroom filter." />
              ) : (
                <ol className="grid gap-3">
                  {result.results.map((r, i) => (
                    <ResultCard key={r.id} result={r} rank={i + 1} />
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <div className={cn('rounded-xl border border-dashed border-input p-10 text-center')}>
              <Sparkles className="mx-auto size-8 text-marigold" strokeWidth={1.6} />
              <p className="mt-3 font-bold">Your ranked results appear here</p>
              <p className="mt-1 text-sm text-muted-foreground">Each result shows where it comes from, its match score and why it was ranked there.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
