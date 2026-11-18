// Listing page: filters on the left (a dialog on phones), results grid and pagination.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Pagination from '@mui/material/Pagination';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/common';
import { Seo } from '@/components/common/Seo';
import { FilterPanel } from '@/components/property/FilterPanel';
import { PropertyGrid } from '@/components/property/PropertyCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/misc';
import { usePropertyFilters } from '@/hooks/usePropertyFilters';
import { plural, TYPE_LABELS } from '@/lib/format';
import { propertyService } from '@/services';
import type { PropertyType } from '@/types';

const PAGE_SIZE = 12;

function headingFor(f: { purpose: string; type: string; bedrooms: string; location: string }) {
  const bhk = f.bedrooms ? `${f.bedrooms === '4' ? '4+' : f.bedrooms} BHK ` : '';
  const type = f.type ? `${TYPE_LABELS[f.type as PropertyType].toLowerCase()}s` : 'properties';
  const purpose = f.purpose === 'sale' ? ' for sale' : f.purpose === 'rent' ? ' for rent' : '';
  const where = f.location ? ` in ${f.location.replace(/\b\w/g, (c) => c.toUpperCase())}` : ' across India';
  const text = `${bhk}${type}${purpose}${where}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function PropertiesPage() {
  const { filters, setFilters, clearFilters, activeCount } = usePropertyFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertyService.search({ ...filters, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData, // keep the old results visible while the new page loads
  });

  const heading = headingFor(filters);
  const data = query.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Seo title={heading} description={`${heading}. Browse verified owner listings with photos, prices and area, and book a viewing on EstateHub.`} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-muted-foreground" aria-live="polite">
            {query.isPending ? 'Searching…' : data ? `${plural(data.pagination.total, 'listing')} found` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal /> Filters{activeCount > 0 && ` (${activeCount})`}
          </Button>
          <NativeSelect aria-label="Sort listings" value={filters.sort || 'newest'} onChange={(e) => setFilters({ sort: e.target.value === 'newest' ? '' : e.target.value })} className="w-48">
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="area_desc">Largest first</option>
            <option value="popular">Most viewed</option>
          </NativeSelect>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 rounded-xl border bg-card p-5">
            <FilterPanel filters={filters} setFilters={setFilters} clearFilters={clearFilters} activeCount={activeCount} />
          </div>
        </aside>

        <section aria-busy={query.isFetching}>
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : data && data.properties.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No listings match these filters"
              description="Try a nearby locality, a wider budget or fewer filters."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {activeCount > 0 && <Button onClick={clearFilters}>Clear filters</Button>}
                  <Button asChild variant="outline">
                    <Link to="/dashboard/listings/new">List a property</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
              <PropertyGrid properties={data?.properties} loading={query.isPending} />
            </div>
          )}

          {data && data.pagination.totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination
                count={data.pagination.totalPages}
                page={data.pagination.page}
                shape="rounded"
                color="primary"
                onChange={(_e, page) => {
                  setFilters({ page });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </section>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Filters</DialogTitle>
          <FilterPanel filters={filters} setFilters={setFilters} clearFilters={clearFilters} activeCount={activeCount} />
          <Button onClick={() => setFiltersOpen(false)}>{data ? `Show ${plural(data.pagination.total, 'listing')}` : 'Show listings'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
