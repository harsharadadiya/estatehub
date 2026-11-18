import { useQuery } from '@tanstack/react-query';
import { configService } from '@/services';

/** Public settings from the API (property types, amenities, viewing slots…). Cached for the whole visit. */
export function useConfig() {
  return useQuery({ queryKey: ['config'], queryFn: configService.get, staleTime: Infinity });
}
