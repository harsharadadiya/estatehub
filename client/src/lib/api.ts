// One Axios instance for every API call:
//  • adds the login token to each request
//  • turns any error into { message, status, code, fieldErrors }
import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'estatehub_token';
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';
/** Where the API itself lives (used for locally stored images like /uploads/abc.jpg) */
export const API_ORIGIN = API_URL.startsWith('http') ? new URL(API_URL).origin : '';

export const api = axios.create({ baseURL: API_URL, timeout: 30_000 });

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage blocked: the session lasts until the tab is closed */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: () => void = () => {};
/** AuthContext registers what to do when the server says the token is no longer valid */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  fieldErrors: Record<string, string>;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; code?: string; errors?: Array<{ field: string; message: string }> }>) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) onUnauthorized();
    return Promise.reject(toApiError(error));
  }
);

function toApiError(error: AxiosError<{ message?: string; code?: string; errors?: Array<{ field: string; message: string }> }>): ApiError {
  if (error.response) {
    const { data, status } = error.response;
    const fieldErrors: Record<string, string> = {};
    for (const item of data?.errors ?? []) fieldErrors[item.field] = item.message;
    const fallback = status === 429 ? 'Too many requests. Please wait a moment and try again.' : 'Something went wrong. Please try again.';
    return { message: data?.message || fallback, status, code: data?.code, fieldErrors };
  }
  if (error.code === 'ECONNABORTED') return { message: 'The server took too long to answer. Please try again.', status: 0, fieldErrors: {} };
  return { message: 'Cannot reach the server. Check your internet connection or that the API is running.', status: 0, fieldErrors: {} };
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'message' in error && 'fieldErrors' in error;
}

export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : error instanceof Error ? error.message : 'Something went wrong';
}
