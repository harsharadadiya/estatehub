// Viewing requests for MY properties. Confirm or decline; visitors get an email.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { AppointmentItem, isUpcoming } from '@/components/appointments/AppointmentItem';
import { ConfirmDialog, EmptyState, ErrorState } from '@/components/common';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { appointmentService } from '@/services';
import type { Appointment } from '@/types';
import { PageTitle } from './DashboardLayout';

type TabKey = 'pending' | 'confirmed' | 'history';
const byTime = (a: Appointment, b: Appointment) => (a.date + a.time).localeCompare(b.date + b.time);

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['appointments', 'received'], queryFn: appointmentService.received });
  const [tab, setTab] = useState<TabKey>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDecline, setToDecline] = useState<Appointment | null>(null);

  const all = query.data ?? [];
  const lists: Record<TabKey, Appointment[]> = {
    pending: all.filter((a) => a.status === 'pending' && isUpcoming(a)).sort(byTime),
    confirmed: all.filter((a) => a.status === 'confirmed' && isUpcoming(a)).sort(byTime),
    history: all.filter((a) => !isUpcoming(a)),
  };

  async function setStatus(appointment: Appointment, status: 'confirmed' | 'cancelled') {
    setBusyId(appointment._id);
    try {
      await appointmentService.setStatus(appointment._id, status);
      toast.success(status === 'confirmed' ? `Viewing confirmed. ${appointment.name} has been emailed.` : `Viewing declined. ${appointment.name} has been emailed.`);
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    } finally {
      setBusyId(null);
    }
  }

  const empty: Record<TabKey, { title: string; text: string }> = {
    pending: { title: 'No requests waiting', text: 'When someone books a viewing of your property, it shows up here right away.' },
    confirmed: { title: 'No confirmed viewings coming up', text: 'Viewings you confirm appear here until the day of the visit.' },
    history: { title: 'No past requests', text: 'Finished and cancelled viewings are kept here.' },
  };

  return (
    <div>
      <PageTitle title="Viewing requests" description="People who want to see your properties. Confirm a time or decline it, and they get an email." />
      <div className="mb-5 border-b">
        <Tabs value={tab} onChange={(_e, v: TabKey) => setTab(v)} variant="scrollable" allowScrollButtonsMobile aria-label="Request status">
          <Tab value="pending" label={`To answer (${lists.pending.length})`} />
          <Tab value="confirmed" label={`Confirmed (${lists.confirmed.length})`} />
          <Tab value="history" label={`Past and cancelled (${lists.history.length})`} />
        </Tabs>
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={130} />
          ))}
        </div>
      ) : lists[tab].length === 0 ? (
        <EmptyState icon={Inbox} title={empty[tab].title} description={empty[tab].text} />
      ) : (
        <ul className="grid gap-3">
          {lists[tab].map((a) => (
            <AppointmentItem
              key={a._id}
              appointment={a}
              showVisitor
              actions={
                tab === 'history' ? null : (
                  <>
                    {a.status === 'pending' && (
                      <Button size="sm" loading={busyId === a._id} onClick={() => setStatus(a, 'confirmed').catch(() => undefined)}>
                        Confirm viewing
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busyId === a._id} onClick={() => setToDecline(a)}>
                      {a.status === 'pending' ? 'Decline' : 'Cancel viewing'}
                    </Button>
                  </>
                )
              }
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(toDecline)}
        onOpenChange={(open) => !open && setToDecline(null)}
        title={toDecline?.status === 'pending' ? 'Decline this request?' : 'Cancel this viewing?'}
        description={toDecline ? `${toDecline.name} on ${formatDay(toDecline.date)} at ${formatTime(toDecline.time)}. They will get an email and can book another time.` : ''}
        confirmLabel={toDecline?.status === 'pending' ? 'Decline request' : 'Cancel viewing'}
        cancelLabel="Go back"
        destructive
        onConfirm={() => (toDecline ? setStatus(toDecline, 'cancelled') : undefined)}
      />
    </div>
  );
}
