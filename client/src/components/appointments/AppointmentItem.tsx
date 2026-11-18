import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Mail, MessageSquareText, Phone } from 'lucide-react';
import { SafeImage } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { formatDay, formatTime, todayInIndia } from '@/lib/format';
import type { Appointment } from '@/types';

export const STATUS_LABEL: Record<Appointment['status'], string> = { pending: 'Waiting for owner', confirmed: 'Confirmed', cancelled: 'Cancelled' };

export function StatusBadge({ appointment }: { appointment: Appointment }) {
  const text =
    appointment.status === 'cancelled' && appointment.cancelledBy
      ? `Cancelled by ${appointment.cancelledBy === 'owner' ? 'owner' : 'visitor'}`
      : STATUS_LABEL[appointment.status];
  return <Badge variant={appointment.status}>{text}</Badge>;
}

export function isUpcoming(a: Appointment) {
  return a.date >= todayInIndia() && a.status !== 'cancelled';
}

/** One viewing. "showVisitor" shows the visitor's contact details (for owners). */
export function AppointmentItem({ appointment, showVisitor = false, actions }: { appointment: Appointment; showVisitor?: boolean; actions?: ReactNode }) {
  const p = appointment.property;
  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row">
      <SafeImage src={p?.images[0]?.url} width={320} alt={p?.title ?? 'Removed listing'} className="h-32 w-full shrink-0 rounded-lg sm:h-24 sm:w-32" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          {p ? (
            <Link to={`/properties/${p._id}`} className="font-bold hover:text-primary">
              {p.title}
            </Link>
          ) : (
            <span className="font-bold text-muted-foreground">This listing was removed</span>
          )}
          <StatusBadge appointment={appointment} />
        </div>
        {p && (
          <p className="text-sm text-muted-foreground">
            {p.location.locality}, {p.location.city}
          </p>
        )}
        <p className="flex items-center gap-1.5 font-semibold tabular">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          {formatDay(appointment.date)} at {formatTime(appointment.time)}
        </p>
        {showVisitor && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">{appointment.name}</span>
            <a href={`tel:${appointment.phone}`} className="flex items-center gap-1 text-primary hover:underline">
              <Phone className="size-3.5" /> {appointment.phone}
            </a>
            <a href={`mailto:${appointment.email}`} className="flex items-center gap-1 text-primary hover:underline">
              <Mail className="size-3.5" /> {appointment.email}
            </a>
            {!appointment.user && <Badge variant="outline">Guest</Badge>}
          </div>
        )}
        {appointment.message && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> “{appointment.message}”
          </p>
        )}
        {actions && <div className="mt-1 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </li>
  );
}
