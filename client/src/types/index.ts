// Shapes of the data the API sends (they match the Mongoose models on the server)

export type Purpose = 'sale' | 'rent';
export type PropertyType = 'apartment' | 'independent-house' | 'villa' | 'plot' | 'commercial' | 'office';
export type Furnishing = 'unfurnished' | 'semi-furnished' | 'furnished';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface PropertyImage {
  url: string;
  fileId: string;
  provider: 'imagekit' | 'local';
}

export interface PropertyLocation {
  address: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Property {
  _id: string;
  title: string;
  description?: string;
  purpose: Purpose;
  type: PropertyType;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  amenities: string[];
  images: PropertyImage[];
  location: PropertyLocation;
  owner: { _id: string; name: string; createdAt?: string; phone?: string } | string;
  status: 'active' | 'inactive';
  views: number;
  createdAt: string;
  updatedAt: string;
  pendingRequests?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Appointment {
  _id: string;
  property: Pick<Property, '_id' | 'title' | 'images' | 'location' | 'price' | 'purpose' | 'type' | 'bedrooms' | 'area' | 'status'> | null;
  owner: string;
  user: string | null;
  name: string;
  email: string;
  phone: string;
  message: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  cancelledBy: 'visitor' | 'owner' | null;
  createdAt: string;
}

export interface AppConfig {
  propertyTypes: PropertyType[];
  furnishing: Furnishing[];
  amenities: string[];
  maxImages: number;
  viewingSlots: string[];
  storage: 'imagekit' | 'local';
  aiHub: boolean;
}

export interface DashboardSummary {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  myUpcomingViewings: number;
  pendingRequests: number;
  confirmedUpcomingRequests: number;
}

export interface HubResult {
  id: string;
  source: string;
  isPlatform: boolean;
  propertyId: string | null;
  url: string;
  title: string;
  priceInr: number | null;
  priceText: string | null;
  bedrooms: number | null;
  areaSqft: number | null;
  locality: string | null;
  image: string | null;
  score: number;
  reasons: string[];
}

export interface HubResponse {
  results: HubResult[];
  meta: {
    rankedBy: 'ai' | 'rules';
    usedWebSources: boolean;
    retries: number;
    retryLog: string[];
    removedRentals: number;
    removedDuplicates: number;
    durationMs: number;
    warnings: string[];
  };
}
