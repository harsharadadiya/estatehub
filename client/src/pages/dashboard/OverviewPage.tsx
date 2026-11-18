import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Skeleton from '@mui/material/Skeleton';
import { Plus } from 'lucide-react';
import { AppointmentItem, isUpcoming } from '@/components/appointments/AppointmentItem';
import { EmptyState, ErrorState } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { appointmentService } from '@/services';
import { PageTitle, useSummary } from './DashboardLayout';

export default function OverviewPage() {
  const { user } = useAuth();
  const summary = useSummary();
  const mine = useQuery({ queryKey: ['appointments', 'mine'], queryFn: appointmentService.mine });
  const received = useQuery({ queryKey: ['appointments', 'received'], queryFn: appointmentService.received });

  const s = summary.data;
  const stats = [
    { label: 'Active listings', value: s ? `${s.activeListings}` : '', sub: s ? `of ${s.totalListings} total` : '', to: '/dashboard/listings' },
    { label: 'Listing views', value: s ? s.totalViews.toLocaleString('en-IN') : '', sub: 'across all listings', to: '/dashboard/listings' },
    { label: 'Requests to answer', value: s ? `${s.pendingRequests}` : '', sub: s ? `${s.confirmedUpcomingRequests} confirmed and upcoming` : '', to: '/dashboard/requests', highlight: (s?.pendingRequests ?? 0) > 0 },
    { label: 'My upcoming viewings', value: s ? `${s.myUpcomingViewings}` : '', sub: 'homes you will visit', to: '/dashboard/appointments' },
  ];

  const nextVisits = (mine.data ?? []).filter(isUpcoming).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);
  const toAnswer = (received.data ?? []).filter((a) => a.status === 'pending' && isUpcoming(a)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);

  return (
    <div>
      <PageTitle
        title={`Hello, ${user?.name.split(' ')[0]}`}
        description="Your listings and viewings at a glance. This page updates live."
        action={
          <Button asChild>
            <Link to="/dashboard/listings/new">
              <Plus /> Add a listing
            </Link>
          </Button>
        }
      />

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border xl:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.label} to={stat.to} className="bg-card p-5 hover:bg-muted/60">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              {summary.isPending ? (
                <Skeleton width={60} height={44} />
              ) : (
                <p className={`text-3xl font-extrabold tabular ${stat.highlight ? 'text-[#a86a00]' : ''}`}>{stat.value}</p>
              )}
              <p className="text-[13px] text-muted-foreground">{stat.sub}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-10 xl:grid-cols-2">
        <section aria-labelledby="answer-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="answer-heading" className="text-lg font-bold">
              Requests to answer
            </h2>
            <Link to="/dashboard/requests" className="text-sm font-semibold text-primary hover:underline">
              All requests
            </Link>
          </div>
          {received.isPending ? (
            <Skeleton variant="rounded" height={120} />
          ) : toAnswer.length === 0 ? (
            <EmptyState title="Nothing to answer" description="New viewing requests for your listings appear here as soon as they are booked." className="py-10" />
          ) : (
            <ul className="grid gap-3">
              {toAnswer.map((a) => (
                <AppointmentItem key={a._id} appointment={a} showVisitor />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="visits-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="visits-heading" className="text-lg font-bold">
              Your next visits
            </h2>
            <Link to="/dashboard/appointments" className="text-sm font-semibold text-primary hover:underline">
              All my viewings
            </Link>
          </div>
          {mine.isPending ? (
            <Skeleton variant="rounded" height={120} />
          ) : nextVisits.length === 0 ? (
            <EmptyState title="No visits planned" description="Find a home you like and book a viewing time." action={<Button asChild variant="outline"><Link to="/properties">Browse listings</Link></Button>} className="py-10" />
          ) : (
            <ul className="grid gap-3">
              {nextVisits.map((a) => (
                <AppointmentItem key={a._id} appointment={a} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
