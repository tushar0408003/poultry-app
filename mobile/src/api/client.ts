import axios, { AxiosError, isAxiosError } from 'axios';
import { API_URL } from '../config';

export const api = axios.create({ // eslint-disable-line import/no-named-as-default-member
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Called once by AuthProvider: logs the user out when the server rejects the token. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin && authToken) onUnauthorized?.();
    return Promise.reject(error);
  },
);

/** Turns any API/network error into a short message suitable for showing to the user. */
export function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return error.code === 'ECONNABORTED'
        ? 'The server is taking too long. Please try again.'
        : `Cannot reach the server (${API_URL}). Check your internet connection.`;
    }
    const message = (error.response.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(message)) return message.join('\n');
    if (message) return message;
    return `Request failed (${error.response.status})`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
