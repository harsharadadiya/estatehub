// Create a new listing or edit one of yours. Fields are validated in the browser and again on the server.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState, FormField, PageLoader } from '@/components/common';
import { ImageUploader, type UploadItem } from '@/components/property/ImageUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox, NativeSelect } from '@/components/ui/misc';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/hooks/useConfig';
import { isApiError } from '@/lib/api';
import { formatPrice, formatRupees, FURNISHING_LABELS, TYPE_LABELS } from '@/lib/format';
import { dashboardService, propertyService } from '@/services';
import type { Furnishing, Property, PropertyType } from '@/types';
import { PageTitle } from './DashboardLayout';

const num = (label: string, min: number, max: number) =>
  z.number({ message: `Enter the ${label}` }).int(`${label} must be a whole number`).min(min, `Minimum ${min}`).max(max, `Maximum ${max}`);

const schema = z.object({
  title: z.string().trim().min(10, 'Title must be at least 10 characters').max(120),
  description: z.string().trim().min(30, 'Describe the property in at least 30 characters').max(4000),
  purpose: z.enum(['sale', 'rent']),
  type: z.enum(['apartment', 'independent-house', 'villa', 'plot', 'commercial', 'office'], { message: 'Choose a property type' }),
  price: z.number({ message: 'Enter the price' }).int('Use a whole number of rupees').min(1000, 'Minimum ₹1,000').max(10_000_000_000),
  area: z.number({ message: 'Enter the area' }).min(50, 'Minimum 50 sq ft').max(1_000_000),
  bedrooms: num('number of bedrooms', 0, 20),
  bathrooms: num('number of bathrooms', 0, 20),
  furnishing: z.enum(['unfurnished', 'semi-furnished', 'furnished']),
  amenities: z.array(z.string()),
  location: z.object({
    address: z.string().trim().min(5, 'Enter the street address'),
    locality: z.string().trim().min(2, 'Enter the locality'),
    city: z.string().trim().min(2, 'Enter the city'),
    state: z.string().trim().min(2, 'Enter the state'),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  }),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  title: '',
  description: '',
  purpose: 'sale',
  type: undefined as unknown as Values['type'],
  price: undefined as unknown as number,
  area: undefined as unknown as number,
  bedrooms: 2,
  bathrooms: 2,
  furnishing: 'unfurnished',
  amenities: [],
  location: { address: '', locality: '', city: '', state: '', pincode: '' },
};

const fromProperty = (p: Property): Values => ({
  title: p.title,
  description: p.description ?? '',
  purpose: p.purpose,
  type: p.type,
  price: p.price,
  area: p.area,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  furnishing: p.furnishing,
  amenities: p.amenities,
  location: { ...p.location },
});

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 rounded-xl border bg-card p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function ListingEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const config = useConfig();
  const maxImages = config.data?.maxImages ?? 4;

  const existing = useQuery({ queryKey: ['property', id, 'edit'], queryFn: () => dashboardService.myListing(id!), enabled: isEdit });
  const [images, setImages] = useState<UploadItem[]>([]);
  const [imagesError, setImagesError] = useState('');

  const { register, control, handleSubmit, reset, watch, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { errors, isSubmitting, isDirty } = formState;

  useEffect(() => {
    if (!existing.data) return;
    reset(fromProperty(existing.data.property));
    setImages(existing.data.property.images.map((img) => ({ kind: 'existing', id: img.fileId, fileId: img.fileId, url: img.url })));
  }, [existing.data, reset]);

  if (isEdit && existing.isPending) return <PageLoader label="Loading your listing…" />;
  if (isEdit && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  if (isEdit && existing.data && !existing.data.isOwner) return <ErrorState error={{ message: 'You can only edit your own listings', status: 403, fieldErrors: {} }} />;

  const purpose = watch('purpose');
  const price = watch('price');
  const type = watch('type');
  const noBedrooms = type === 'plot' || type === 'commercial' || type === 'office';
  const imagesChanged = isEdit && existing.data && JSON.stringify(images.map((i) => i.id)) !== JSON.stringify(existing.data.property.images.map((i) => i.fileId));

  async function onSubmit(values: Values) {
    if (images.length === 0) {
      setImagesError('Add at least one photo');
      document.getElementById('photos')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setImagesError('');

    const form = new FormData();
    const newFiles = images.filter((i): i is Extract<UploadItem, { kind: 'new' }> => i.kind === 'new');
    const payload: Record<string, unknown> = { ...values, bedrooms: noBedrooms ? 0 : values.bedrooms };
    if (isEdit) {
      // Tell the server the final photo order: existing photos by id, new ones as "new:0", "new:1"…
      payload.imageOrder = images.map((i) => (i.kind === 'existing' ? i.fileId : `new:${newFiles.indexOf(i)}`));
    }
    form.append('data', JSON.stringify(payload));
    newFiles.forEach((i) => form.append('images', i.file));

    try {
      const saved = isEdit ? await propertyService.update(id!, form) : await propertyService.create(form);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
      void queryClient.invalidateQueries({ queryKey: ['property', saved._id] });
      toast.success(isEdit ? 'Changes saved' : 'Listing published');
      navigate(`/properties/${saved._id}`);
    } catch (error) {
      if (!isApiError(error)) return toast.error('Could not save the listing');
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        if (field === 'images') setImagesError(message);
        else setError(field as keyof Values, { message });
      }
      toast.error(error.message);
    }
  }

  return (
    <div>
      <Link to="/dashboard/listings" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> My listings
      </Link>
      <PageTitle title={isEdit ? 'Edit listing' : 'List your property'} description={isEdit ? 'Changes are live as soon as you save.' : 'Fill in the details buyers and tenants ask about first. It takes about five minutes.'} />

      {!user?.phone && (
        <Alert severity="info" className="mb-6">
          Add a phone number in your <Link to="/dashboard/profile" className="font-semibold underline">profile</Link> so logged-in visitors can call you.
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the highlighted fields'))} className="grid gap-6" noValidate>
        <Section title="Basics">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="I want to">
              <Controller
                name="purpose"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup exclusive fullWidth size="small" color="primary" value={field.value} onChange={(_e, v) => v && field.onChange(v)} aria-label="Sell or rent out">
                    <ToggleButton value="sale">Sell</ToggleButton>
                    <ToggleButton value="rent">Rent out</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </FormField>
            <FormField label="Property type" htmlFor="type" error={errors.type?.message}>
              <NativeSelect id="type" aria-invalid={!!errors.type} {...register('type')} defaultValue="">
                <option value="" disabled>
                  Choose a type
                </option>
                {(Object.keys(TYPE_LABELS) as PropertyType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="Title" htmlFor="title" error={errors.title?.message} hint="For example: 2 BHK with balcony near Baner metro">
            <Input id="title" maxLength={120} aria-invalid={!!errors.title} {...register('title')} />
          </FormField>
          <FormField label="Description" htmlFor="description" error={errors.description?.message} hint="Floor, facing, society, nearby schools, offices and transport">
            <Textarea id="description" rows={6} maxLength={4000} aria-invalid={!!errors.description} {...register('description')} />
          </FormField>
        </Section>

        <Section title="Price and size">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label={purpose === 'rent' ? 'Monthly rent (₹)' : 'Price (₹)'}
              htmlFor="price"
              error={errors.price?.message}
              hint={price > 0 ? `${formatRupees(price)} – shown as ${formatPrice(price)}${purpose === 'rent' ? '/month' : ''}` : 'Full amount in rupees, e.g. 7500000'}
            >
              <Input id="price" type="number" inputMode="numeric" min={1000} step={1} aria-invalid={!!errors.price} {...register('price', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Area (sq ft)" htmlFor="area" error={errors.area?.message}>
              <Input id="area" type="number" inputMode="numeric" min={50} aria-invalid={!!errors.area} {...register('area', { valueAsNumber: true })} />
            </FormField>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {!noBedrooms && (
              <FormField label="Bedrooms (BHK)" htmlFor="bedrooms" error={errors.bedrooms?.message}>
                <Input id="bedrooms" type="number" inputMode="numeric" min={0} max={20} {...register('bedrooms', { valueAsNumber: true })} />
              </FormField>
            )}
            <FormField label="Bathrooms" htmlFor="bathrooms" error={errors.bathrooms?.message}>
              <Input id="bathrooms" type="number" inputMode="numeric" min={0} max={20} {...register('bathrooms', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Furnishing" htmlFor="furnishing">
              <NativeSelect id="furnishing" {...register('furnishing')}>
                {(Object.keys(FURNISHING_LABELS) as Furnishing[]).map((f) => (
                  <option key={f} value={f}>
                    {FURNISHING_LABELS[f]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
        </Section>

        <Section title="Location" description="The full address is shown on the listing so visitors can find it.">
          <FormField label="Street address" htmlFor="address" error={errors.location?.address?.message} hint="Building, street or road">
            <Input id="address" autoComplete="street-address" {...register('location.address')} />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Locality" htmlFor="locality" error={errors.location?.locality?.message}>
              <Input id="locality" placeholder="e.g. Baner" {...register('location.locality')} />
            </FormField>
            <FormField label="City" htmlFor="city" error={errors.location?.city?.message}>
              <Input id="city" autoComplete="address-level2" placeholder="e.g. Pune" {...register('location.city')} />
            </FormField>
            <FormField label="State" htmlFor="state" error={errors.location?.state?.message}>
              <Input id="state" autoComplete="address-level1" placeholder="e.g. Maharashtra" {...register('location.state')} />
            </FormField>
            <FormField label="Pincode" htmlFor="pincode" error={errors.location?.pincode?.message}>
              <Input id="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} {...register('location.pincode')} />
            </FormField>
          </div>
        </Section>

        <Section title="Amenities">
          <Controller
            name="amenities"
            control={control}
            render={({ field }) => (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(config.data?.amenities ?? []).map((a) => {
                  const checked = field.value.includes(a);
                  return (
                    <label key={a} className="flex cursor-pointer items-center gap-2.5 text-[15px]">
                      <Checkbox checked={checked} onCheckedChange={(on) => field.onChange(on ? [...field.value, a] : field.value.filter((x) => x !== a))} />
                      {a}
                    </label>
                  );
                })}
              </div>
            )}
          />
        </Section>

        <div id="photos">
          <Section title="Photos" description="Clear daylight photos of the living room, bedrooms, kitchen and view get the most visits.">
            <ImageUploader items={images} onChange={(next) => (setImages(next), setImagesError(''))} max={maxImages} error={imagesError} />
          </Section>
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-t bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <Button type="button" variant="ghost" onClick={() => navigate('/dashboard/listings')}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={isSubmitting} disabled={isEdit && !isDirty && !imagesChanged}>
            {isSubmitting ? 'Uploading…' : isEdit ? 'Save changes' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </div>
  );
}
