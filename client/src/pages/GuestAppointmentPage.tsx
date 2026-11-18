// Guests (no account) open this page from the link in their booking email to see or cancel their viewing.
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppointmentItem, isUpcoming } from '@/components/appointments/AppointmentItem';
import { ConfirmDialog, EmptyState, PageLoader } from '@/components/common';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { appointmentService } from '@/services';

export default function GuestAppointmentPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({ queryKey: ['guest-appointment', id], queryFn: () => appointmentService.getAsGuest(id, token), enabled: Boolean(token), retry: false });

  async function cancel() {
    try {
      const result = await appointmentService.cancelAsGuest(id, token);
      queryClient.setQueryData(['guest-appointment', id], result.appointment);
      toast.success('Your viewing is cancelled. The owner has been told.');
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Seo title="Your viewing" noIndex />
      <h1 className="mb-6 text-2xl font-extrabold">Your viewing</h1>
      {!token || query.isError ? (
        <EmptyState title="This link does not work" description="Open the link again from your booking email. It must include the full address." action={<Button asChild><Link to="/properties">Browse listings</Link></Button>} />
      ) : query.isPending ? (
        <PageLoader />
      ) : (
        <ul>
          <AppointmentItem
            appointment={query.data}
            actions={
              isUpcoming(query.data) ? (
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
                  Cancel viewing
                </Button>
              ) : null
            }
          />
        </ul>
      )}
      <p className="mt-8 text-[15px] text-muted-foreground">
        Create an account with the same email to see all your viewings in one dashboard.{' '}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create account
        </Link>
      </p>
      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Cancel this viewing?" description="The owner gets an email and the time becomes free for others." confirmLabel="Cancel viewing" cancelLabel="Keep viewing" destructive onConfirm={cancel} />
    </div>
  );
}
