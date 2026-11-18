import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PropertyFilters } from '@/services';

const KEYS = ['location', 'purpose', 'type', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'bedrooms', 'furnishing', 'sort', 'page'] as const;
export type FilterKey = (typeof KEYS)[number];

/**
 * Filters live in the address bar (?location=pune&type=apartment…),
 * so the back button works, a refresh keeps the search, and a search can be shared as a link.
 */
export function usePropertyFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<FilterKey, string>, [params]);

  const setFilters = useCallback(
    (changes: Partial<Record<FilterKey, string | number | undefined | null>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === '' || value === undefined || value === null) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in changes)) next.delete('page'); // any new filter starts at page 1
          return next;
        },
        { replace: false }
      );
    },
    [setParams]
  );

  const clearFilters = useCallback(() => {
    setParams(new URLSearchParams(params.get('purpose') ? { purpose: params.get('purpose')! } : {}));
  }, [params, setParams]);

  const activeCount = (['location', 'type', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'bedrooms', 'furnishing'] as const).filter((k) => filters[k]).length;

  return { filters: filters as Record<FilterKey, string> & PropertyFilters, setFilters, clearFilters, activeCount };
}

/** Price choices the way Indian buyers think about them */
export const PRICE_STEPS = {
  sale: [1_000_000, 2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000],
  rent: [5_000, 10_000, 15_000, 20_000, 30_000, 50_000, 75_000, 100_000, 200_000],
};
