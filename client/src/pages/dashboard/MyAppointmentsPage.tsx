// Viewings I booked (as a visitor). Upcoming first; cancel any upcoming one.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@mui/material/Skeleton';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { AppointmentItem, isUpcoming } from '@/components/appointments/AppointmentItem';
import { ConfirmDialog, EmptyState, ErrorState } from '@/components/common';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { appointmentService } from '@/services';
import type { Appointment } from '@/types';
import { PageTitle } from './DashboardLayout';

export default function MyAppointmentsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['appointments', 'mine'], queryFn: appointmentService.mine });
  const [toCancel, setToCancel] = useState<Appointment | null>(null);

  const all = query.data ?? [];
  const upcoming = all.filter(isUpcoming).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = all.filter((a) => !isUpcoming(a));

  async function cancel() {
    if (!toCancel) return;
    try {
      await appointmentService.setStatus(toCancel._id, 'cancelled');
      toast.success('Viewing cancelled. The owner has been told.');
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  return (
    <div>
      <PageTitle title="My viewings" description="Homes you asked to visit. Owners confirm each request, and the status here updates live." />
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="You have not booked a viewing yet"
          description="Open any listing, pick a day and time, and the owner will confirm it."
          action={
            <Button asChild>
              <Link to="/properties">Browse listings</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-10">
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="mb-3 text-lg font-bold">
              Upcoming ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">No upcoming viewings.</p>
            ) : (
              <ul className="grid gap-3">
                {upcoming.map((a) => (
                  <AppointmentItem
                    key={a._id}
                    appointment={a}
                    actions={
                      <Button variant="outline" size="sm" onClick={() => setToCancel(a)}>
                        Cancel viewing
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="mb-3 text-lg font-bold">
                Past and cancelled ({past.length})
              </h2>
              <ul className="grid gap-3 opacity-90">
                {past.map((a) => (
                  <AppointmentItem key={a._id} appointment={a} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toCancel)}
        onOpenChange={(open) => !open && setToCancel(null)}
        title="Cancel this viewing?"
        description={toCancel ? `${toCancel.property?.title ?? 'This listing'} on ${formatDay(toCancel.date)} at ${formatTime(toCancel.time)}. The owner gets an email and the time becomes free for others.` : ''}
        confirmLabel="Cancel viewing"
        cancelLabel="Keep viewing"
        destructive
        onConfirm={cancel}
      />
    </div>
  );
}
