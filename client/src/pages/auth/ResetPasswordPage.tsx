import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import { toast } from 'sonner';
import { FormField, PasswordInput } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/api';
import { authService } from '@/services';
import { AuthShell, PASSWORD_RULES } from './AuthShell';

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Add at least one letter').regex(/\d/, 'Add at least one number').max(72),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { startSession } = useAuth();
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirmPassword: '' } });
  const { errors, isSubmitting } = formState;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthShell title="This reset link is not valid">
        <p className="text-[15px] text-muted-foreground">The link may be incomplete. Open it again from your email, or ask for a new one.</p>
        <Button asChild className="mt-5 w-full">
          <Link to="/forgot-password">Ask for a new link</Link>
        </Button>
      </AuthShell>
    );
  }

  async function onSubmit({ password }: Values) {
    try {
      const session = await authService.resetPassword({ token, password });
      startSession(session.token, session.user);
      toast.success('Password updated. You are logged in.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  }

  return (
    <AuthShell title="Choose a new password" description="After saving, you are logged in and other devices are logged out.">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {errors.root && (
          <Alert severity="error" action={<Link to="/forgot-password" className="self-center text-sm font-semibold underline">New link</Link>}>
            {errors.root.message}
          </Alert>
        )}
        <FormField label="New password" htmlFor="password" error={errors.password?.message} hint={PASSWORD_RULES}>
          <PasswordInput id="password" autoComplete="new-password" autoFocus aria-invalid={!!errors.password} {...register('password')} />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting}>
          Save new password
        </Button>
      </form>
    </AuthShell>
  );
}
