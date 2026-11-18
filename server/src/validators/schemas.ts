// All request validation rules (Zod). The frontend uses the same rules.
import { z } from 'zod';
import { AMENITIES, FURNISHING, MAX_IMAGES, PROPERTY_STATUS, PROPERTY_TYPES, PURPOSES } from '../models/Property.js';

/** A text field with a friendly message when it is missing completely */
const text = (label: string) => z.string({ message: `${label} is required` });

const objectId = z.string({ message: 'Id is required' }).regex(/^[a-f\d]{24}$/i, 'Invalid id');
const indianPhone = text('Phone number')
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'));
const email = text('Email').trim().toLowerCase().email('Enter a valid email address').max(120);
const password = text('Password')
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');
const name = text('Name').trim().min(2, 'Name must be at least 2 characters').max(60);

/* ---------------- Auth & users ---------------- */

export const registerSchema = z.object({
  name,
  email,
  password,
  phone: z.union([indianPhone, z.literal('')]).optional().default(''),
});

export const loginSchema = z.object({
  email,
  password: text('Password').min(1, 'Password is required').max(72),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is not valid'),
  password,
});

export const updateProfileSchema = z
  .object({ name: name.optional(), phone: z.union([indianPhone, z.literal('')]).optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: password })
  .refine((v) => v.currentPassword !== v.newPassword, { message: 'New password must be different', path: ['newPassword'] });

export const deleteAccountSchema = z.object({ password: z.string().min(1, 'Password is required') });

/* ---------------- Properties ---------------- */

const propertyFields = {
  title: z.string().trim().min(10, 'Title must be at least 10 characters').max(120),
  description: z.string().trim().min(30, 'Description must be at least 30 characters').max(4000),
  purpose: z.enum(PURPOSES, { message: 'Choose sale or rent' }),
  type: z.enum(PROPERTY_TYPES, { message: 'Choose a property type' }),
  price: z.coerce.number({ message: 'Price must be a number' }).int('Price must be a whole number').min(1000, 'Minimum price is ₹1,000').max(10_000_000_000),
  area: z.coerce.number({ message: 'Area must be a number' }).min(50, 'Minimum area is 50 sq ft').max(1_000_000),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
  furnishing: z.enum(FURNISHING),
  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).default([]),
  location: z.object({
    address: z.string().trim().min(5, 'Address is required').max(200),
    locality: z.string().trim().min(2, 'Locality is required').max(100),
    city: z.string().trim().min(2, 'City is required').max(80),
    state: z.string().trim().min(2, 'State is required').max(80),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  }),
};

export const createPropertySchema = z.object(propertyFields);

export const updatePropertySchema = createPropertySchema.partial().extend({
  status: z.enum(PROPERTY_STATUS).optional(),
  /** fileIds of existing images to keep, in the order to show them (new uploads go after them) */
  keepImages: z.array(z.string().min(1)).max(MAX_IMAGES).optional(),
  /**
   * Full photo order, mixing kept and new photos: ["<fileId>", "new:0", "<fileId>"].
   * "new:0" is the first uploaded file in this request. The first photo is the cover.
   */
  imageOrder: z.array(z.string().min(1)).min(1).max(MAX_IMAGES).optional(),
});

const optionalNumber = z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.coerce.number().min(0).optional());

export const propertyQuerySchema = z
  .object({
    location: z.string().trim().max(100).optional(),
    purpose: z.enum(PURPOSES).optional(),
    type: z.enum(PROPERTY_TYPES).optional(),
    minPrice: optionalNumber,
    maxPrice: optionalNumber,
    minArea: optionalNumber,
    maxArea: optionalNumber,
    bedrooms: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).max(20).optional()),
    furnishing: z.enum(FURNISHING).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'area_desc', 'popular']).default('newest'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'Minimum price cannot be more than maximum price',
    path: ['maxPrice'],
  })
  .refine((q) => q.minArea === undefined || q.maxArea === undefined || q.minArea <= q.maxArea, {
    message: 'Minimum area cannot be more than maximum area',
    path: ['maxArea'],
  });

export type PropertyQuery = z.infer<typeof propertyQuerySchema>;

/* ---------------- Appointments ---------------- */

const slot = {
  propertyId: objectId,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time'),
  message: z.string().trim().max(500, 'Message is too long').optional().default(''),
};

export const guestAppointmentSchema = z.object({ ...slot, name, email, phone: indianPhone });
export const userAppointmentSchema = z.object({ ...slot, phone: indianPhone.optional() });
export const appointmentStatusSchema = z.object({ status: z.enum(['confirmed', 'cancelled']) });
export const guestCancelSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'This cancel link is not valid') });
export const slotsQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD') });

/* ---------------- AI Property Hub ---------------- */

export const aiSearchSchema = z
  .object({
    city: z.string().trim().min(2, 'Enter a city').max(60),
    locality: z.string().trim().max(80).optional().default(''),
    propertyType: z.enum(['any', 'apartment', 'independent-house', 'villa', 'plot']).default('any'),
    bedrooms: z.coerce.number().int().min(0).max(10).optional(),
    minBudget: optionalNumber,
    maxBudget: optionalNumber,
    query: z.string().trim().max(300).optional().default(''),
    maxResults: z.coerce.number().int().min(3).max(10).default(6),
  })
  .refine((v) => v.minBudget === undefined || v.maxBudget === undefined || v.minBudget <= v.maxBudget, {
    message: 'Minimum budget cannot be more than maximum budget',
    path: ['maxBudget'],
  });

export type AiSearchInput = z.infer<typeof aiSearchSchema>;
