import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export const PROPERTY_TYPES = ['apartment', 'independent-house', 'villa', 'plot', 'commercial', 'office'] as const;
export const PURPOSES = ['sale', 'rent'] as const;
export const FURNISHING = ['unfurnished', 'semi-furnished', 'furnished'] as const;
export const PROPERTY_STATUS = ['active', 'inactive'] as const;
export const AMENITIES = [
  'Lift',
  'Power backup',
  'Covered parking',
  'Security',
  'CCTV',
  'Gym',
  'Swimming pool',
  'Clubhouse',
  'Garden',
  'Children play area',
  'Gated community',
  'Water supply 24x7',
  'Gas pipeline',
  'Intercom',
  'Rainwater harvesting',
  'Pet friendly',
] as const;

export const MAX_IMAGES = 4;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface IPropertyImage {
  url: string;
  fileId: string; // ImageKit fileId, or the local file name
  provider: 'imagekit' | 'local';
}

export interface IProperty {
  _id: Types.ObjectId;
  title: string;
  description: string;
  purpose: (typeof PURPOSES)[number];
  type: PropertyType;
  price: number; // INR. For rent: per month
  area: number; // square feet (carpet / built-up)
  bedrooms: number; // BHK
  bathrooms: number;
  furnishing: (typeof FURNISHING)[number];
  amenities: string[];
  images: IPropertyImage[];
  location: {
    address: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
  };
  owner: Types.ObjectId;
  status: (typeof PROPERTY_STATUS)[number];
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PropertyDoc = HydratedDocument<IProperty>;

const imageSchema = new Schema<IPropertyImage>(
  {
    url: { type: String, required: true },
    fileId: { type: String, required: true },
    provider: { type: String, enum: ['imagekit', 'local'], required: true },
  },
  { _id: false }
);

const propertySchema = new Schema<IProperty>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    purpose: { type: String, enum: PURPOSES, required: true },
    type: { type: String, enum: PROPERTY_TYPES, required: true },
    price: { type: Number, required: true, min: 1 },
    area: { type: Number, required: true, min: 1 },
    bedrooms: { type: Number, default: 0, min: 0, max: 20 },
    bathrooms: { type: Number, default: 0, min: 0, max: 20 },
    furnishing: { type: String, enum: FURNISHING, default: 'unfurnished' },
    amenities: [{ type: String, trim: true }],
    images: {
      type: [imageSchema],
      validate: {
        validator: (list: IPropertyImage[]) => list.length >= 1 && list.length <= MAX_IMAGES,
        message: `A property needs 1 to ${MAX_IMAGES} images`,
      },
    },
    location: {
      address: { type: String, required: true, trim: true, maxlength: 200 },
      locality: { type: String, required: true, trim: true, maxlength: 100 },
      city: { type: String, required: true, trim: true, maxlength: 80 },
      state: { type: String, required: true, trim: true, maxlength: 80 },
      pincode: { type: String, required: true, trim: true, match: /^\d{6}$/ },
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: PROPERTY_STATUS, default: 'active' },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes for the common searches (status + filters, newest first)
propertySchema.index({ status: 1, purpose: 1, type: 1, price: 1 });
propertySchema.index({ status: 1, 'location.city': 1 });
propertySchema.index({ status: 1, area: 1 });
propertySchema.index({ status: 1, createdAt: -1 });

propertySchema.set('toJSON', { versionKey: false });

export const Property = mongoose.model<IProperty>('Property', propertySchema);
