import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Skeleton from '@mui/material/Skeleton';
import { Bath, BedDouble, CalendarDays, Check, ChevronLeft, ExternalLink, Eye, Maximize2, Phone, Sofa } from 'lucide-react';
import { EmptyState, ErrorState, UserAvatar } from '@/components/common';
import { Seo } from '@/components/common/Seo';
import { BookViewingPanel } from '@/components/property/BookViewingPanel';
import { PropertyCard, PriceTag } from '@/components/property/PropertyCard';
import { PropertyGallery } from '@/components/property/PropertyGallery';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/misc';
import { isApiError } from '@/lib/api';
import { configLabel, formatArea, formatRupees, FURNISHING_LABELS, plural, pricePerSqft, PURPOSE_LABELS } from '@/lib/format';
import { imageUrl } from '@/lib/images';
import { propertyService } from '@/services';

export default function PropertyDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['property', id], queryFn: () => propertyService.get(id) });
  const similar = useQuery({ queryKey: ['property', id, 'similar'], queryFn: () => propertyService.similar(id), enabled: query.isSuccess });

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        {isApiError(query.error) && (query.error.status === 404 || query.error.status === 400) ? (
          <EmptyState title="This listing is not available" description="The owner may have sold it or taken it down." action={<Button asChild><Link to="/properties">Browse other listings</Link></Button>} />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }

  const { property, isOwner } = query.data;
  const owner = typeof property.owner === 'object' ? property.owner : null;
  const { location } = property;
  const fullAddress = `${location.address}, ${location.locality}, ${location.city}, ${location.state} ${location.pincode}`;
  const perSqft = pricePerSqft(property);

  const facts = [
    property.bedrooms > 0 && { icon: BedDouble, label: 'Bedrooms', value: `${property.bedrooms} BHK` },
    { icon: Bath, label: 'Bathrooms', value: String(property.bathrooms) },
    { icon: Maximize2, label: 'Area', value: formatArea(property.area) },
    { icon: Sofa, label: 'Furnishing', value: FURNISHING_LABELS[property.furnishing] },
  ].filter(Boolean) as Array<{ icon: typeof Bath; label: string; value: string }>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Seo
        title={`${configLabel(property)} ${PURPOSE_LABELS[property.purpose].toLowerCase()} in ${location.locality}, ${location.city}`}
        description={`${property.title}. ${formatArea(property.area)}, ${formatRupees(property.price)}${property.purpose === 'rent' ? ' per month' : ''}. ${property.description?.slice(0, 110) ?? ''}`}
        image={imageUrl(property.images[0]?.url, 1200)}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'RealEstateListing',
          name: property.title,
          description: property.description,
          image: property.images.map((i) => imageUrl(i.url)),
          datePosted: property.createdAt,
          offers: { '@type': 'Offer', price: property.price, priceCurrency: 'INR' },
          address: { '@type': 'PostalAddress', streetAddress: location.address, addressLocality: location.city, addressRegion: location.state, postalCode: location.pincode, addressCountry: 'IN' },
        }}
      />

      <Link to="/properties" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> All listings
      </Link>

      {property.status === 'inactive' && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[15px] text-amber-900">This listing is hidden from search. Only you can see it.</p>
      )}

      <PropertyGallery images={property.images} title={property.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article className="min-w-0">
          <p className="font-semibold text-primary">
            {configLabel(property)} {PURPOSE_LABELS[property.purpose].toLowerCase()}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{property.title}</h1>
          <p className="mt-2 text-muted-foreground">{fullAddress}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <PriceTag property={property} className="text-xl" />
            {perSqft && <span className="text-muted-foreground tabular">{perSqft}</span>}
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-card p-4">
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" /> {label}
                </dt>
                <dd className="mt-1 font-bold tabular">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-10" aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-xl font-bold">
              About this property
            </h2>
            <p className="mt-3 max-w-[70ch] leading-relaxed whitespace-pre-line text-foreground/90">{property.description}</p>
          </section>

          {property.amenities.length > 0 && (
            <section className="mt-10" aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className="text-xl font-bold">
                Amenities
              </h2>
              <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-[15px]">
                    <Check className="size-4 text-primary" aria-hidden="true" /> {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10" aria-labelledby="location-heading">
            <h2 id="location-heading" className="text-xl font-bold">
              Location
            </h2>
            <p className="mt-2 text-[15px]">{fullAddress}</p>
            <Button asChild variant="outline" className="mt-3">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open in Google Maps
              </a>
            </Button>
          </section>

          <Separator className="my-10" />

          <section className="flex flex-wrap items-center gap-4" aria-label="Owner">
            <UserAvatar name={owner?.name} className="size-12 text-base" />
            <div className="flex-1">
              <p className="font-bold">Listed by {owner?.name ?? 'the owner'}</p>
              <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> Listed {new Date(property.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" /> {plural(property.views, 'view')}
                </span>
              </p>
            </div>
            {owner?.phone ? (
              <Button asChild variant="outline">
                <a href={`tel:${owner.phone}`}>
                  <Phone /> {owner.phone}
                </a>
              </Button>
            ) : (
              !isOwner && (
                <Button asChild variant="ghost">
                  <Link to="/login" state={{ from: `/properties/${property._id}` }}>
                    Log in to see the phone number
                  </Link>
                </Button>
              )
            )}
          </section>
        </article>

        <aside>
          <div className="rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
            {isOwner ? (
              <div className="grid gap-3">
                <h2 className="text-lg font-bold">This is your listing</h2>
                <p className="text-[15px] text-muted-foreground">Visitors book viewings here. You confirm or decline them in your dashboard.</p>
                <Button asChild>
                  <Link to={`/dashboard/listings/${property._id}/edit`}>Edit listing</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/dashboard/requests">See viewing requests</Link>
                </Button>
              </div>
            ) : property.status === 'active' ? (
              <>
                <h2 id="book" className="mb-4 scroll-mt-24 text-lg font-bold">
                  Book a viewing
                </h2>
                <BookViewingPanel propertyId={property._id} />
              </>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Phones: the booking panel is far down the page, so keep a shortcut at the bottom */}
      {!isOwner && property.status === 'active' && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <PriceTag property={property} />
          <Button onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })}>Book a viewing</Button>
        </div>
      )}

      {similar.data && similar.data.length > 0 && (
        <section className="mt-16" aria-labelledby="similar-heading">
          <h2 id="similar-heading" className="text-2xl font-extrabold">
            Similar homes nearby
          </h2>
          <p className="text-muted-foreground">Picked by type, locality, size and price.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.data.map((p) => (
              <PropertyCard key={p._id} property={p} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading listing">
      <Skeleton variant="rounded" height={440} sx={{ borderRadius: '16px' }} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <Skeleton width="30%" />
          <Skeleton width="70%" height={48} />
          <Skeleton width="50%" />
          <Skeleton variant="rounded" height={90} sx={{ mt: 4 }} />
        </div>
        <Skeleton variant="rounded" height={420} sx={{ borderRadius: '16px' }} />
      </div>
    </div>
  );
}
