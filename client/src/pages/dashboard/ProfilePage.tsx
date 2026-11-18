import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ConfirmDialog, FormField, PasswordInput } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { tokenStore, isApiError, errorMessage } from '@/lib/api';
import { userService } from '@/services';
import { PASSWORD_RULES } from '../auth/AuthShell';
import { PageTitle } from './DashboardLayout';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(60),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => v === '' || /^(\+91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number'),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Add a letter').regex(/\d/, 'Add a number').max(72),
  })
  .refine((v) => v.currentPassword !== v.newPassword, { message: 'Choose a different password', path: ['newPassword'] });

type ProfileValues = z.input<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const profile = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: { name: user?.name ?? '', phone: user?.phone ?? '' } });
  const password = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '' } });

  async function saveProfile(values: ProfileValues) {
    try {
      const updated = await userService.update({ name: values.name, phone: values.phone.replace(/[\s-]/g, '') });
      setUser(updated);
      toast.success('Profile saved');
    } catch (e) {
      if (isApiError(e)) Object.entries(e.fieldErrors).forEach(([f, m]) => profile.setError(f as keyof ProfileValues, { message: m }));
      toast.error(errorMessage(e));
    }
  }

  async function changePassword(values: PasswordValues) {
    try {
      const result = await userService.changePassword(values);
      tokenStore.set(result.token); // this device stays logged in, others are logged out
      password.reset();
      toast.success('Password changed. Other devices were logged out.');
    } catch (e) {
      if (isApiError(e)) Object.entries(e.fieldErrors).forEach(([f, m]) => password.setError(f as keyof PasswordValues, { message: m }));
      toast.error(errorMessage(e));
    }
  }

  async function deleteAccount() {
    setDeleteError('');
    try {
      await userService.deleteAccount(deletePassword);
      logout();
      toast.success('Your account and listings were deleted');
      navigate('/');
    } catch (e) {
      setDeleteError(errorMessage(e));
      throw e;
    }
  }

  return (
    <div className="grid max-w-2xl gap-8">
      <PageTitle title="Profile" />

      <form onSubmit={profile.handleSubmit(saveProfile)} className="grid gap-4 rounded-xl border bg-card p-5 sm:p-6" noValidate>
        <h2 className="text-lg font-bold">Your details</h2>
        <FormField label="Email">
          <Input value={user?.email ?? ''} disabled />
        </FormField>
        <FormField label="Full name" htmlFor="p-name" error={profile.formState.errors.name?.message}>
          <Input id="p-name" autoComplete="name" {...profile.register('name')} />
        </FormField>
        <FormField label="Mobile number" htmlFor="p-phone" error={profile.formState.errors.phone?.message} hint="Logged-in visitors of your listings can see it. It also fills in viewing bookings for you.">
          <Input id="p-phone" type="tel" autoComplete="tel" {...profile.register('phone')} />
        </FormField>
        <Button type="submit" className="justify-self-start" loading={profile.formState.isSubmitting} disabled={!profile.formState.isDirty}>
          Save details
        </Button>
      </form>

      <form onSubmit={password.handleSubmit(changePassword)} className="grid gap-4 rounded-xl border bg-card p-5 sm:p-6" noValidate>
        <h2 className="text-lg font-bold">Change password</h2>
        <FormField label="Current password" htmlFor="cur-pw" error={password.formState.errors.currentPassword?.message}>
          <PasswordInput id="cur-pw" autoComplete="current-password" {...password.register('currentPassword')} />
        </FormField>
        <FormField label="New password" htmlFor="new-pw" error={password.formState.errors.newPassword?.message} hint={PASSWORD_RULES}>
          <PasswordInput id="new-pw" autoComplete="new-password" {...password.register('newPassword')} />
        </FormField>
        <Button type="submit" className="justify-self-start" loading={password.formState.isSubmitting}>
          Change password
        </Button>
      </form>

      <section className="grid gap-3 rounded-xl border border-orange-200 bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Delete account</h2>
        <p className="text-[15px] text-muted-foreground">Deletes your account, all your listings and their photos, and cancels your upcoming viewings. This cannot be undone.</p>
        <Button variant="outline" className="justify-self-start border-destructive/40 text-destructive hover:bg-orange-50" onClick={() => setDeleteOpen(true)}>
          Delete my account
        </Button>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => (setDeleteOpen(open), setDeletePassword(''), setDeleteError(''))}
        title="Delete your account for good?"
        description="Enter your password to confirm."
        confirmLabel="Delete account"
        destructive
        onConfirm={deleteAccount}
      >
        <FormField label="Password" htmlFor="del-pw" error={deleteError}>
          <PasswordInput id="del-pw" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoComplete="current-password" />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}
