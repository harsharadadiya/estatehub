import { format, parseISO } from 'date-fns';
import type { Furnishing, Property, PropertyType, Purpose } from '@/types';

/** 7800000 -> "₹78 L", 12500000 -> "₹1.25 Cr", 28000 -> "₹28,000" */
export function formatPrice(amount: number): string {
  if (amount >= 1e7) return `₹${round(amount / 1e7)} Cr`;
  if (amount >= 1e5) return `₹${round(amount / 1e5)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Full rupee amount with Indian grouping: 7800000 -> "₹78,00,000" */
export const formatRupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

const round = (n: number) => String(Math.round(n * 100) / 100);

export const priceLabel = (p: Pick<Property, 'price' | 'purpose'>) => `${formatPrice(p.price)}${p.purpose === 'rent' ? '/month' : ''}`;

export const pricePerSqft = (p: Pick<Property, 'price' | 'area' | 'purpose'>) =>
  p.purpose === 'sale' && p.area > 0 ? `₹${Math.round(p.price / p.area).toLocaleString('en-IN')}/sq ft` : null;

export const TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Apartment',
  'independent-house': 'Independent house',
  villa: 'Villa',
  plot: 'Plot',
  commercial: 'Commercial',
  office: 'Office space',
};

export const PURPOSE_LABELS: Record<Purpose, string> = { sale: 'For sale', rent: 'For rent' };

export const FURNISHING_LABELS: Record<Furnishing, string> = {
  unfurnished: 'Unfurnished',
  'semi-furnished': 'Semi-furnished',
  furnished: 'Fully furnished',
};

/** "2 BHK Apartment" / "Plot" */
export function configLabel(p: Pick<Property, 'bedrooms' | 'type'>): string {
  if (p.type === 'plot' || p.type === 'commercial' || p.type === 'office' || p.bedrooms === 0) return TYPE_LABELS[p.type];
  return `${p.bedrooms} BHK ${TYPE_LABELS[p.type]}`;
}

export const formatArea = (sqft: number) => `${sqft.toLocaleString('en-IN')} sq ft`;

/** "2026-11-20" -> "Fri, 20 Nov 2026" */
export const formatDay = (date: string, pattern = 'EEE, d MMM yyyy') => format(parseISO(date), pattern);

/** "14:30" -> "2:30 PM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const plural = (count: number, word: string, many = `${word}s`) => `${count.toLocaleString('en-IN')} ${count === 1 ? word : many}`;

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** Today's date in India as "YYYY-MM-DD" */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
