import { Link } from 'react-router-dom';
import { BedDouble, Maximize2, MapPin } from 'lucide-react';
import Skeleton from '@mui/material/Skeleton';
import { SafeImage } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { formatArea, priceLabel, PURPOSE_LABELS, TYPE_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Property } from '@/types';

/** The marigold price tag – the signature element of the design */
export function PriceTag({ property, className }: { property: Pick<Property, 'price' | 'purpose'>; className?: string }) {
  return <span className={cn('price-tag text-[15px]', className)}>{priceLabel(property)}</span>;
}

export function PropertyCard({ property, compact = false }: { property: Property; compact?: boolean }) {
  const { location } = property;
  return (
    <Link
      to={`/properties/${property._id}`}
      className="group block overflow-hidden rounded-xl border bg-card outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <SafeImage src={property.images[0]?.url} width={640} alt={property.title} className="size-full transition-transform duration-500 group-hover:scale-[1.03]" />
        <PriceTag property={property} className="absolute bottom-3 left-0 shadow-sm" />
        {property.status === 'inactive' && (
          <Badge variant="inactive" className="absolute top-3 left-3">
            Hidden
          </Badge>
        )}
      </div>
      <div className={cn('grid gap-1.5 p-4', compact && 'p-3')}>
        <p className="text-[13px] font-semibold text-primary">
          {TYPE_LABELS[property.type]} {PURPOSE_LABELS[property.purpose].toLowerCase()}
        </p>
        <h3 className="line-clamp-1 font-bold group-hover:text-primary">{property.title}</h3>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {location.locality}, {location.city}
          </span>
        </p>
        <div className="mt-1 flex items-center gap-4 text-sm tabular">
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1.5">
              <BedDouble className="size-4 text-muted-foreground" aria-hidden="true" /> {property.bedrooms} BHK
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Maximize2 className="size-3.5 text-muted-foreground" aria-hidden="true" /> {formatArea(property.area)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" aria-hidden="true">
      <Skeleton variant="rectangular" sx={{ width: '100%', height: 'auto', aspectRatio: '4 / 3' }} />
      <div className="grid gap-1 p-4">
        <Skeleton width="35%" />
        <Skeleton width="85%" height={26} />
        <Skeleton width="55%" />
        <Skeleton width="45%" />
      </div>
    </div>
  );
}

export function PropertyGrid({ properties, loading, count = 6 }: { properties?: Property[]; loading?: boolean; count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {loading ? Array.from({ length: count }, (_, i) => <PropertyCardSkeleton key={i} />) : properties?.map((p) => <PropertyCard key={p._id} property={p} />)}
    </div>
  );
}
