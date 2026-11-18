import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import { Eye, Home, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog, EmptyState, ErrorState, SafeImage } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { configLabel, plural, priceLabel } from '@/lib/format';
import { dashboardService, propertyService } from '@/services';
import type { Property } from '@/types';
import { PageTitle } from './DashboardLayout';

export default function MyListingsPage() {
  const queryClient = useQueryClient();
  const listings = useQuery({ queryKey: ['dashboard', 'properties'], queryFn: dashboardService.properties });
  const [toDelete, setToDelete] = useState<Property | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['properties'] });
  };

  const toggle = useMutation({
    mutationFn: (p: Property) => propertyService.update(p._id, { status: p.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: (p) => {
      toast.success(p.status === 'active' ? 'Listing is visible in search again' : 'Listing hidden from search');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function remove() {
    if (!toDelete) return;
    try {
      const result = await propertyService.remove(toDelete._id);
      toast.success(result.cancelledViewings ? `Listing deleted. ${plural(result.cancelledViewings, 'upcoming viewing')} cancelled and visitors emailed.` : 'Listing deleted');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  return (
    <div>
      <PageTitle
        title="My listings"
        description="Edit, hide or delete your properties. Hidden listings keep their data but do not appear in search."
        action={
          <Button asChild>
            <Link to="/dashboard/listings/new">
              <Plus /> Add a listing
            </Link>
          </Button>
        }
      />

      {listings.isError ? (
        <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
      ) : listings.isPending ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={104} />
          ))}
        </div>
      ) : listings.data.length === 0 ? (
        <EmptyState
          icon={Home}
          title="You have not listed a property yet"
          description="Add photos, price and location. Visitors can book viewings straight away."
          action={
            <Button asChild>
              <Link to="/dashboard/listings/new">Add your first listing</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {listings.data.map((p) => (
            <li key={p._id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
              <SafeImage src={p.images[0]?.url} width={320} alt={p.title} className="h-36 w-full shrink-0 rounded-lg sm:h-20 sm:w-28" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/properties/${p._id}`} className="truncate font-bold hover:text-primary">
                    {p.title}
                  </Link>
                  {p.status === 'inactive' && <Badge variant="inactive">Hidden</Badge>}
                  {!!p.pendingRequests && (
                    <Link to="/dashboard/requests">
                      <Badge variant="pending">{plural(p.pendingRequests, 'new request')}</Badge>
                    </Link>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {configLabel(p)} in {p.location.locality}, {p.location.city}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-4 text-sm tabular">
                  <b>{priceLabel(p)}</b>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="size-3.5" /> {plural(p.views, 'view')}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip title={p.status === 'active' ? 'Visible in search – click to hide' : 'Hidden – click to show in search'}>
                  <Switch checked={p.status === 'active'} disabled={toggle.isPending && toggle.variables?._id === p._id} onChange={() => toggle.mutate(p)} slotProps={{ input: { 'aria-label': `Show ${p.title} in search` } }} />
                </Tooltip>
                <Button asChild variant="ghost" size="icon" aria-label={`Edit ${p.title}`}>
                  <Link to={`/dashboard/listings/${p._id}/edit`}>
                    <Pencil />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${p.title}`} onClick={() => setToDelete(p)}>
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this listing?"
        description={`"${toDelete?.title}" and its photos will be removed for good. Upcoming viewings are cancelled and visitors get an email. To keep the data, hide the listing instead.`}
        confirmLabel="Delete listing"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
