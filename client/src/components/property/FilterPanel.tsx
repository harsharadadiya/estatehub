// Filters: purpose, location, type, price, BHK, area, furnishing.
import { useEffect, useState, type FormEvent } from 'react';
import Slider from '@mui/material/Slider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { Search } from 'lucide-react';
import { FormField } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/misc';
import { PRICE_STEPS, type FilterKey } from '@/hooks/usePropertyFilters';
import { formatArea, formatPrice, FURNISHING_LABELS, TYPE_LABELS } from '@/lib/format';
import type { Furnishing, PropertyType } from '@/types';

const AREA_MAX = 5000;

interface Props {
  filters: Record<FilterKey, string>;
  setFilters: (changes: Partial<Record<FilterKey, string | number | undefined | null>>) => void;
  clearFilters: () => void;
  activeCount: number;
}

export function FilterPanel({ filters, setFilters, clearFilters, activeCount }: Props) {
  const [location, setLocation] = useState(filters.location);
  const [area, setArea] = useState<number[]>([Number(filters.minArea) || 0, Number(filters.maxArea) || AREA_MAX]);

  // Keep the inputs in sync with the URL (back button, "clear all")
  useEffect(() => setLocation(filters.location), [filters.location]);
  useEffect(() => setArea([Number(filters.minArea) || 0, Number(filters.maxArea) || AREA_MAX]), [filters.minArea, filters.maxArea]);

  const steps = filters.purpose === 'rent' ? PRICE_STEPS.rent : filters.purpose === 'sale' ? PRICE_STEPS.sale : [...PRICE_STEPS.rent.slice(0, 5), ...PRICE_STEPS.sale];
  const minPrice = Number(filters.minPrice) || 0;
  const maxPrice = Number(filters.maxPrice) || 0;

  function submitLocation(event: FormEvent) {
    event.preventDefault();
    setFilters({ location: location.trim() });
  }

  return (
    <div className="grid gap-6">
      <FormField label="Looking to">
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          color="primary"
          value={filters.purpose || 'any'}
          onChange={(_e, value: string | null) => value && setFilters({ purpose: value === 'any' ? '' : value, minPrice: '', maxPrice: '' })}
          aria-label="Buy or rent"
        >
          <ToggleButton value="any">Any</ToggleButton>
          <ToggleButton value="sale">Buy</ToggleButton>
          <ToggleButton value="rent">Rent</ToggleButton>
        </ToggleButtonGroup>
      </FormField>

      <form onSubmit={submitLocation}>
        <FormField label="Location" htmlFor="filter-location" hint="City, locality or pincode">
          <div className="relative">
            <Input id="filter-location" value={location} onChange={(e) => setLocation(e.target.value)} onBlur={() => location.trim() !== filters.location && setFilters({ location: location.trim() })} placeholder="e.g. Pune, Baner, 411045" className="pr-10" maxLength={100} />
            <button type="submit" className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Search location">
              <Search className="size-4" />
            </button>
          </div>
        </FormField>
      </form>

      <FormField label="Property type" htmlFor="filter-type">
        <NativeSelect id="filter-type" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })}>
          <option value="">All types</option>
          {(Object.keys(TYPE_LABELS) as PropertyType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField label={filters.purpose === 'rent' ? 'Monthly rent' : 'Budget'}>
        <div className="grid grid-cols-2 gap-2">
          <NativeSelect aria-label="Minimum price" value={filters.minPrice} onChange={(e) => setFilters({ minPrice: e.target.value })}>
            <option value="">No min</option>
            {steps.filter((s) => !maxPrice || s < maxPrice).map((s) => (
              <option key={s} value={s}>
                {formatPrice(s)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Maximum price" value={filters.maxPrice} onChange={(e) => setFilters({ maxPrice: e.target.value })}>
            <option value="">No max</option>
            {steps.filter((s) => s > minPrice).map((s) => (
              <option key={s} value={s}>
                {formatPrice(s)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </FormField>

      <FormField label="Bedrooms">
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          color="primary"
          value={filters.bedrooms || 'any'}
          onChange={(_e, value: string | null) => value && setFilters({ bedrooms: value === 'any' ? '' : value })}
          aria-label="Bedrooms"
        >
          <ToggleButton value="any">Any</ToggleButton>
          <ToggleButton value="1">1</ToggleButton>
          <ToggleButton value="2">2</ToggleButton>
          <ToggleButton value="3">3</ToggleButton>
          <ToggleButton value="4">4+</ToggleButton>
        </ToggleButtonGroup>
      </FormField>

      <FormField label="Area (sq ft)">
        <div className="px-2">
          <Slider
            value={area}
            onChange={(_e, value) => setArea(value as number[])}
            onChangeCommitted={(_e, value) => {
              const [min, max] = value as number[];
              setFilters({ minArea: min! > 0 ? min : '', maxArea: max! < AREA_MAX ? max : '' });
            }}
            min={0}
            max={AREA_MAX}
            step={50}
            disableSwap
            getAriaLabel={(i) => (i === 0 ? 'Minimum area' : 'Maximum area')}
            getAriaValueText={(v) => formatArea(v)}
          />
        </div>
        <p className="flex justify-between text-sm text-muted-foreground tabular">
          <span>{area[0] ? formatArea(area[0]) : 'Any size'}</span>
          <span>{area[1]! < AREA_MAX ? formatArea(area[1]!) : `${formatArea(AREA_MAX)}+`}</span>
        </p>
      </FormField>

      <FormField label="Furnishing" htmlFor="filter-furnishing">
        <NativeSelect id="filter-furnishing" value={filters.furnishing} onChange={(e) => setFilters({ furnishing: e.target.value })}>
          <option value="">Any</option>
          {(Object.keys(FURNISHING_LABELS) as Furnishing[]).map((f) => (
            <option key={f} value={f}>
              {FURNISHING_LABELS[f]}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      {activeCount > 0 && (
        <Button variant="outline" onClick={clearFilters}>
          Clear {activeCount === 1 ? 'filter' : `${activeCount} filters`}
        </Button>
      )}
    </div>
  );
}
