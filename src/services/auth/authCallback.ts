import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { getSupabaseClient } from '../supabase/client';
import { getAuthRedirectUrl } from './redirect';

function isAuthCallbackUrl(url: string): boolean {
  return url.includes('auth/callback') || url.includes('access_token=');
}

/** Exchange tokens from a magic-link redirect into a persisted session. */
export async function createSessionFromAuthUrl(
  url: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isAuthCallbackUrl(url)) {
    return { ok: false, message: 'Not an auth callback URL.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    return { ok: false, message: decodeURIComponent(errorCode.replace(/\+/g, ' ')) };
  }

  if (params.error_description) {
    return {
      ok: false,
      message: decodeURIComponent(String(params.error_description).replace(/\+/g, ' ')),
    };
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    return { ok: false, message: 'Magic link did not include session tokens.' };
  }

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export { getAuthRedirectUrl, isAuthCallbackUrl };
