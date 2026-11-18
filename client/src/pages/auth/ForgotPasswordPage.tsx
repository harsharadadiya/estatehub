import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import { MailCheck } from 'lucide-react';
import { FormField } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { authService } from '@/services';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address') });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<{ email: string; devResetUrl?: string } | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const { errors, isSubmitting } = formState;

  async function onSubmit({ email }: Values) {
    try {
      const result = await authService.forgotPassword(email);
      setSent({ email, devResetUrl: result.devResetUrl });
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  }

  if (sent) {
    const devPath = sent.devResetUrl ? new URL(sent.devResetUrl).pathname + new URL(sent.devResetUrl).search : null;
    return (
      <AuthShell title="Check your email" footer={<Link to="/login" className="font-semibold text-primary hover:underline">Back to log in</Link>}>
        <div className="grid gap-4">
          <MailCheck className="size-10 text-primary" strokeWidth={1.6} />
          <p className="text-[15px]">
            If an account exists for <b>{sent.email}</b>, we sent a link to reset the password. It works for 30 minutes.
          </p>
          <p className="text-sm text-muted-foreground">No email after a few minutes? Check your spam folder, or try again.</p>
          {devPath && (
            <Alert severity="info">
              Development mode: email is not set up on the API, so here is the reset link.{' '}
              <Link to={devPath} className="font-semibold underline">
                Reset password now
              </Link>
            </Alert>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" description="Enter your account email and we will send you a reset link." footer={<Link to="/login" className="font-semibold text-primary hover:underline">Back to log in</Link>}>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
