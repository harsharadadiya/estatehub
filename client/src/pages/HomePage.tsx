import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { Building2, Search } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/common';
import { Seo } from '@/components/common/Seo';
import { PriceTag, PropertyGrid } from '@/components/property/PropertyCard';
import { SafeImage } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/misc';
import { PRICE_STEPS } from '@/hooks/usePropertyFilters';
import { configLabel, formatPrice, plural, TYPE_LABELS } from '@/lib/format';
import { propertyService } from '@/services';
import type { PropertyType } from '@/types';

function HeroSearch() {
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState<'sale' | 'rent'>('sale');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ purpose });
    if (location.trim()) params.set('location', location.trim());
    if (type) params.set('type', type);
    if (maxPrice) params.set('maxPrice', maxPrice);
    navigate(`/properties?${params}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-card p-5 shadow-[0_18px_40px_-28px_rgb(22_35_59/0.45)]" role="search">
      <ToggleButtonGroup exclusive size="small" color="primary" value={purpose} onChange={(_e, v: 'sale' | 'rent' | null) => v && (setPurpose(v), setMaxPrice(''))} aria-label="Buy or rent" className="w-fit">
        <ToggleButton value="sale" sx={{ px: 3 }}>
          Buy
        </ToggleButton>
        <ToggleButton value="rent" sx={{ px: 3 }}>
          Rent
        </ToggleButton>
      </ToggleButtonGroup>
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, locality or pincode" aria-label="Location" maxLength={100} className="h-12" />
        <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label="Property type" className="h-12">
          <option value="">Any type</option>
          {(Object.keys(TYPE_LABELS) as PropertyType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label="Maximum budget" className="h-12">
          <option value="">Any budget</option>
          {PRICE_STEPS[purpose].map((s) => (
            <option key={s} value={s}>
              Up to {formatPrice(s)}
              {purpose === 'rent' ? '/month' : ''}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" size="lg" className="h-12">
          <Search /> Search
        </Button>
      </div>
    </form>
  );
}

export default function HomePage() {
  const latest = useQuery({ queryKey: ['properties', 'latest'], queryFn: () => propertyService.search({ limit: 6, sort: 'newest' }) });
  const cities = useQuery({ queryKey: ['cities'], queryFn: propertyService.cities });
  const featured = latest.data?.properties[0];

  return (
    <div>
      <Seo title="EstateHub" jsonLd={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'EstateHub', url: window.location.origin }} />

      {/* ---------- Hero ---------- */}
      <section className="border-b bg-[linear-gradient(180deg,#eaf1ee_0%,var(--background)_100%)]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div>
            <h1 className="max-w-2xl text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-[3.5rem]">Homes for sale and rent, listed by the people who own them.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">Search apartments, houses, villas and plots across Indian cities, then pick a time and book a viewing with the owner.</p>
            <div className="mt-8">
              <HeroSearch />
            </div>
          </div>

          {/* The newest real listing – live data, not a stock photo */}
          <div className="hidden lg:block">
            {featured ? (
              <Link to={`/properties/${featured._id}`} className="group block overflow-hidden rounded-2xl border bg-card">
                <div className="relative aspect-[5/4] overflow-hidden">
                  <SafeImage src={featured.images[0]?.url} width={900} alt={featured.title} className="size-full transition-transform duration-700 group-hover:scale-[1.03]" />
                  <PriceTag property={featured} className="absolute bottom-4 left-0 text-lg" />
                </div>
                <div className="p-5">
                  <p className="text-sm font-semibold text-primary">Just listed</p>
                  <p className="mt-1 text-lg font-bold">{featured.title}</p>
                  <p className="text-muted-foreground">
                    {configLabel(featured)} in {featured.location.locality}, {featured.location.city}
                  </p>
                </div>
              </Link>
            ) : (
              !latest.isPending && (
                <div className="rounded-2xl border border-dashed border-input bg-card/70 p-10 text-center">
                  <Building2 className="mx-auto size-10 text-primary" strokeWidth={1.5} />
                  <p className="mt-4 text-lg font-bold">Your listing could be the first one here</p>
                  <p className="mt-1 text-muted-foreground">Add photos, price and location in about five minutes.</p>
                  <Button asChild className="mt-5">
                    <Link to="/dashboard/listings/new">List your property</Link>
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ---------- Cities ---------- */}
      {cities.data && cities.data.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8" aria-labelledby="cities-heading">
          <h2 id="cities-heading" className="text-xl font-bold">
            Browse by city
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {cities.data.map(({ city, count }) => (
              <Link key={city} to={`/properties?location=${encodeURIComponent(city)}`} className="rounded-full border bg-card px-4 py-2 text-[15px] font-semibold hover:border-primary hover:text-primary">
                {city} <span className="font-normal text-muted-foreground tabular">{count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Latest listings ---------- */}
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8" aria-labelledby="latest-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="latest-heading" className="text-2xl font-extrabold">
              Latest listings
            </h2>
            {latest.data && <p className="text-muted-foreground">{plural(latest.data.pagination.total, 'home')} listed so far</p>}
          </div>
          <Button asChild variant="link">
            <Link to="/properties">See all listings</Link>
          </Button>
        </div>
        {latest.isError ? (
          <ErrorState error={latest.error} onRetry={() => latest.refetch()} />
        ) : latest.data?.properties.length === 0 ? (
          <EmptyState title="No listings yet" description="When owners publish properties, they appear here first." action={<Button asChild><Link to="/dashboard/listings/new">List your property</Link></Button>} />
        ) : (
          <PropertyGrid properties={latest.data?.properties} loading={latest.isPending} />
        )}
      </section>

      {/* ---------- For owners: a real 3-step process ---------- */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" aria-labelledby="owners-heading">
        <div className="grid gap-8 rounded-2xl bg-foreground p-8 text-background md:grid-cols-[1fr_1.6fr] md:p-10">
          <div>
            <h2 id="owners-heading" className="text-2xl font-extrabold sm:text-3xl">
              Selling or renting out?
            </h2>
            <p className="mt-3 text-background/75">List for free and meet serious buyers and tenants at times that suit you.</p>
            <Button asChild size="lg" className="mt-6 bg-marigold text-marigold-foreground hover:bg-marigold/90">
              <Link to="/dashboard/listings/new">List your property</Link>
            </Button>
          </div>
          <ol className="grid gap-5 sm:grid-cols-3">
            {[
              ['Add your listing', 'Price, area, location and up to four photos.'],
              ['Get viewing requests', 'Visitors pick a free time slot. You get an email at once.'],
              ['Confirm and meet', 'Confirm or decline in your dashboard. Visitors are notified.'],
            ].map(([title, text], i) => (
              <li key={title} className="border-t border-background/25 pt-4">
                <span className="text-sm font-bold text-marigold tabular">Step {i + 1}</span>
                <p className="mt-1 font-bold">{title}</p>
                <p className="mt-1 text-[15px] text-background/70">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
