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
import { isApiError } from '@/lib/api';
import { AuthShell, PASSWORD_RULES } from './AuthShell';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(60),
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ''))
      .refine((v) => v === '' || /^(\+91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number'),
    password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Add at least one letter').regex(/\d/, 'Add at least one number').max(72),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type Values = z.input<typeof schema>;

export default function RegisterPage() {
  const { user, register: signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard';

  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = formState;

  if (user) return <Navigate to={redirectTo} replace />;

  async function onSubmit(values: Values) {
    try {
      const created = await signUp({ name: values.name, email: values.email, password: values.password, phone: values.phone.replace(/[\s-]/g, '') });
      toast.success(`Welcome to EstateHub, ${created.name.split(' ')[0]}`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (!isApiError(error)) return setError('root', { message: 'Could not create the account' });
      const fields = Object.entries(error.fieldErrors);
      fields.forEach(([field, message]) => setError(field as keyof Values, { message }));
      if (!fields.length) setError('root', { message: error.message });
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="List properties, book viewings and track them in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
        <FormField label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" autoFocus aria-invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label="Mobile number (optional)" htmlFor="phone" error={errors.phone?.message} hint="Shown to logged-in visitors of your listings">
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" aria-invalid={!!errors.phone} {...register('phone')} />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message} hint={PASSWORD_RULES}>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
