// Book a viewing – works for guests (name, email, phone) and logged-in users (one route each, same model).
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDays, format, parseISO } from 'date-fns';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import { CalendarCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormField } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { isApiError } from '@/lib/api';
import { formatDay, formatTime, todayInIndia } from '@/lib/format';
import { cn } from '@/lib/utils';
import { appointmentService, propertyService } from '@/services';

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));

const guestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  phone,
  message: z.string().trim().max(500, 'Keep it under 500 characters'),
});
const userSchema = z.object({ phone, message: z.string().trim().max(500, 'Keep it under 500 characters') });
type FormValues = { name?: string; email?: string; phone: string; message: string };

interface Booked {
  date: string;
  time: string;
  manageUrl?: string;
}

export function BookViewingPanel({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const today = todayInIndia();
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [booked, setBooked] = useState<Booked | null>(null);

  const slots = useQuery({
    queryKey: ['slots', propertyId, date],
    queryFn: () => propertyService.slots(propertyId, date),
    enabled: Boolean(date),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(user ? userSchema : guestSchema) as never,
    defaultValues: { name: '', email: '', phone: user?.phone ?? '', message: '' },
  });
  const { register, handleSubmit, formState, setError } = form;
  const errors = formState.errors;

  const booking = useMutation({
    mutationFn: (values: FormValues) => {
      const base = { propertyId, date, time, message: values.message, phone: values.phone };
      return user
        ? appointmentService.book(base)
        : appointmentService.bookAsGuest({ ...base, name: values.name, email: values.email });
    },
    onSuccess: (result) => {
      setBooked({ date, time, manageUrl: (result as { devManageUrl?: string }).devManageUrl });
      void queryClient.invalidateQueries({ queryKey: ['slots', propertyId] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Viewing requested');
    },
    onError: (error) => {
      if (!isApiError(error)) return toast.error('Could not book the viewing');
      if (error.code === 'SLOT_TAKEN') {
        setTime('');
        void slots.refetch();
      }
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        if (['name', 'email', 'phone', 'message'].includes(field)) setError(field as keyof FormValues, { message });
      }
      toast.error(error.message);
    },
  });

  const selectedDate = useMemo(() => (date ? parseISO(date) : undefined), [date]);
  const firstDay = parseISO(today);
  const lastDay = addDays(firstDay, 60);

  if (booked) {
    return (
      <div className="grid gap-3 text-center">
        <CalendarCheck2 className="mx-auto size-10 text-primary" strokeWidth={1.6} />
        <h3 className="text-lg font-bold">Viewing requested</h3>
        <p className="text-[15px] text-muted-foreground">
          {formatDay(booked.date)} at {formatTime(booked.time)}. The owner will confirm it, and we email you either way.
        </p>
        {user ? (
          <Button asChild>
            <Link to="/dashboard/appointments">See my viewings</Link>
          </Button>
        ) : (
          booked.manageUrl && (
            <Alert severity="info" className="text-left">
              Development mode: email is not set up, so here is the link a guest would receive.{' '}
              <Link to={booked.manageUrl} className="font-semibold underline">
                Open booking page
              </Link>
            </Alert>
          )
        )}
        <Button variant="ghost" onClick={() => (setBooked(null), setTime(''), setDate(''))}>
          Book another time
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => booking.mutate(values))} className="grid gap-4" noValidate>
      <div>
        <p className="mb-2 text-sm font-semibold">1. Pick a day</p>
        <div className="flex justify-center rounded-lg border bg-background/50">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              setDate(d ? format(d, 'yyyy-MM-dd') : '');
              setTime('');
            }}
            disabled={[{ before: firstDay }, { after: lastDay }]}
            startMonth={firstDay}
            endMonth={lastDay}
          />
        </div>
      </div>

      {date && (
        <div>
          <p className="mb-2 text-sm font-semibold">2. Pick a time on {formatDay(date, 'EEE, d MMM')}</p>
          {slots.isPending ? (
            <Skeleton variant="rounded" height={96} />
          ) : slots.isError ? (
            <Alert severity="error" action={<Button size="sm" variant="ghost" type="button" onClick={() => slots.refetch()}>Retry</Button>}>
              Could not load times.
            </Alert>
          ) : slots.data.every((s) => !s.available) ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No free times left on this day. Choose another day.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Viewing time">
              {slots.data.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  role="radio"
                  aria-checked={time === slot.time}
                  disabled={!slot.available}
                  onClick={() => setTime(slot.time)}
                  className={cn(
                    'cursor-pointer rounded-md border py-2 text-sm font-semibold tabular transition-colors',
                    time === slot.time ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary',
                    !slot.available && 'cursor-not-allowed border-dashed bg-muted text-muted-foreground/60 line-through hover:border-border'
                  )}
                >
                  {formatTime(slot.time)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {date && time && (
        <div className="grid gap-3">
          <p className="text-sm font-semibold">3. Your details</p>
          {!user && (
            <>
              <FormField label="Name" htmlFor="b-name" error={errors.name?.message}>
                <Input id="b-name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
              </FormField>
              <FormField label="Email" htmlFor="b-email" error={errors.email?.message} hint="We send the confirmation here">
                <Input id="b-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
              </FormField>
            </>
          )}
          <FormField label="Mobile number" htmlFor="b-phone" error={errors.phone?.message}>
            <Input id="b-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" aria-invalid={!!errors.phone} {...register('phone')} />
          </FormField>
          <FormField label="Message for the owner (optional)" htmlFor="b-message" error={errors.message?.message}>
            <Textarea id="b-message" rows={2} placeholder="Any questions before the visit?" {...register('message')} />
          </FormField>
        </div>
      )}

      <Button type="submit" size="lg" disabled={!date || !time} loading={booking.isPending}>
        {date && time ? `Request viewing at ${formatTime(time)}` : 'Request viewing'}
      </Button>
      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          No account needed.{' '}
          <Link to="/login" state={{ from: location.pathname }} className="font-semibold text-primary hover:underline">
            Log in
          </Link>{' '}
          to keep your viewings in one place.
        </p>
      )}
    </form>
  );
}
