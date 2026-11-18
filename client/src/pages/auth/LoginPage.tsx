import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import { toast } from 'sonner';
import { FormField, PasswordInput } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/api';
import { AuthShell } from './AuthShell';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard';

  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { errors, isSubmitting } = formState;

  if (user) return <Navigate to={redirectTo} replace />;

  async function onSubmit(values: Values) {
    try {
      const loggedIn = await login(values);
      toast.success(`Welcome back, ${loggedIn.name.split(' ')[0]}`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  }

  return (
    <AuthShell
      title="Log in"
      description="Manage your listings and viewings."
      footer={
        <>
          New to EstateHub?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
