// Every API call in one place. Pages and components call these functions (through React Query).
import { api } from '@/lib/api';
import type { AppConfig, Appointment, DashboardSummary, HubResponse, Pagination, Property, User } from '@/types';

type Session = { token: string; user: User };

const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export const configService = {
  get: () => api.get<AppConfig>('/config').then((r) => r.data),
};

export const authService = {
  register: (data: { name: string; email: string; password: string; phone?: string }) => api.post<Session>('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) => api.post<Session>('/auth/login', data).then((r) => r.data),
  forgotPassword: (email: string) => api.post<{ message: string; devResetUrl?: string }>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (data: { token: string; password: string }) => api.post<Session & { message: string }>('/auth/reset-password', data).then((r) => r.data),
};

export const userService = {
  me: () => api.get<{ user: User }>('/users/me').then((r) => r.data.user),
  update: (data: { name?: string; phone?: string }) => api.patch<{ user: User }>('/users/me', data).then((r) => r.data.user),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch<{ message: string; token: string }>('/users/me/password', data).then((r) => r.data),
  deleteAccount: (password: string) => api.delete('/users/me', { data: { password } }).then((r) => r.data),
};

export interface PropertyFilters {
  location?: string;
  purpose?: string;
  type?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  minArea?: string | number;
  maxArea?: string | number;
  bedrooms?: string | number;
  furnishing?: string;
  sort?: string;
  page?: string | number;
  limit?: number;
}

export const propertyService = {
  search: (filters: PropertyFilters) =>
    api.get<{ properties: Property[]; pagination: Pagination }>('/properties', { params: clean({ ...filters }) }).then((r) => r.data),
  cities: () => api.get<{ cities: Array<{ city: string; count: number }> }>('/properties/cities').then((r) => r.data.cities),
  get: (id: string) => api.get<{ property: Property; isOwner: boolean }>(`/properties/${id}`).then((r) => r.data),
  similar: (id: string) => api.get<{ properties: Property[] }>(`/properties/${id}/similar`).then((r) => r.data.properties),
  slots: (id: string, date: string) =>
    api.get<{ date: string; slots: Array<{ time: string; available: boolean }> }>(`/properties/${id}/slots`, { params: { date } }).then((r) => r.data.slots),
  /** multipart/form-data: "data" (JSON) + "images" (files) */
  create: (form: FormData) => api.post<{ property: Property }>('/properties', form, { timeout: 120_000 }).then((r) => r.data.property),
  update: (id: string, body: FormData | Record<string, unknown>) =>
    api.patch<{ property: Property }>(`/properties/${id}`, body, { timeout: 120_000 }).then((r) => r.data.property),
  remove: (id: string) => api.delete<{ message: string; cancelledViewings: number }>(`/properties/${id}`).then((r) => r.data),
};

export interface BookingInput {
  propertyId: string;
  date: string;
  time: string;
  message?: string;
  phone?: string;
  name?: string;
  email?: string;
}

export const appointmentService = {
  bookAsGuest: (data: BookingInput) =>
    api.post<{ appointment: Appointment; message: string; devManageUrl?: string }>('/appointments/guest', data).then((r) => r.data),
  book: (data: BookingInput) => api.post<{ appointment: Appointment; message: string }>('/appointments', data).then((r) => r.data),
  mine: () => api.get<{ appointments: Appointment[] }>('/appointments/mine').then((r) => r.data.appointments),
  received: () => api.get<{ appointments: Appointment[] }>('/appointments/received').then((r) => r.data.appointments),
  setStatus: (id: string, status: 'confirmed' | 'cancelled') =>
    api.patch<{ appointment: Appointment }>(`/appointments/${id}/status`, { status }).then((r) => r.data.appointment),
  getAsGuest: (id: string, token: string) =>
    api.get<{ appointment: Appointment }>(`/appointments/${id}/guest`, { params: { token } }).then((r) => r.data.appointment),
  cancelAsGuest: (id: string, token: string) =>
    api.post<{ appointment: Appointment; message: string }>(`/appointments/${id}/guest-cancel`, { token }).then((r) => r.data),
};

export const dashboardService = {
  summary: () => api.get<{ summary: DashboardSummary }>('/dashboard/summary').then((r) => r.data.summary),
  properties: () => api.get<{ properties: Property[] }>('/dashboard/properties').then((r) => r.data.properties),
  myListing: (id: string) => api.get<{ property: Property; isOwner: boolean }>(`/properties/${id}`).then((r) => r.data),
};

export const realtimeService = {
  ticket: () => api.post<{ ticket: string }>('/realtime/ticket').then((r) => r.data.ticket),
};

export interface AiSearchInput {
  city: string;
  locality?: string;
  propertyType: string;
  bedrooms?: number;
  minBudget?: number;
  maxBudget?: number;
  query?: string;
}

export const aiService = {
  status: () => api.get<{ enabled: boolean; aiRanking: boolean; serverFirecrawlKey: boolean }>('/ai/status').then((r) => r.data),
  search: (input: AiSearchInput, options: { firecrawlKey?: string; simulateRateLimit?: number }) =>
    api
      .post<HubResponse>('/ai/search', input, {
        timeout: 180_000,
        headers: {
          ...(options.firecrawlKey && { 'x-firecrawl-key': options.firecrawlKey }),
          ...(options.simulateRateLimit && { 'x-simulate-rate-limit': String(options.simulateRateLimit) }),
        },
      })
      .then((r) => r.data),
};
