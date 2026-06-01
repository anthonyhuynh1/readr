import { env, hasApiBaseUrl } from '../../config/env';
import { getAccessToken } from '../supabase/client';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!hasApiBaseUrl()) {
    throw new ApiError('Missing EXPO_PUBLIC_API_BASE_URL', 500);
  }

  const url = `${env.apiBaseUrl.replace(/\/$/, '')}${path}`;
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');

  if (options.requireAuth !== false) {
    const token = await getAccessToken();
    if (!token) {
      throw new ApiError('Missing authenticated session', 401);
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new ApiError(payload || 'API request failed', response.status);
  }

  return (await response.json()) as T;
}
