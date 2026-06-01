import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client';
import { getAuthRedirectUrl } from './redirect';

const DEV_GUEST_KEY = 'readr.auth.dev_guest';

export const DEV_GUEST_USER: User = {
  id: 'dev-local-user',
  app_metadata: {},
  user_metadata: { dev_guest: true },
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
  email: 'dev@local.readr',
} as User;

export function isDevGuestUserId(userId: string): boolean {
  return userId === DEV_GUEST_USER.id;
}

export type AuthResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('429')) {
    return (
      'Email rate limit reached. Supabase’s built-in email allows only a few messages per hour. ' +
      'Wait about an hour, set up custom SMTP (Resend/SendGrid), or use “Continue without signing in” in dev.'
    );
  }
  if (lower.includes('only request this after')) {
    return 'Please wait a minute before requesting another code.';
  }
  return message;
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function isDevGuestSession(): Promise<boolean> {
  const value = await AsyncStorage.getItem(DEV_GUEST_KEY);
  return value === 'true';
}

export async function enableDevGuestSession(): Promise<User> {
  await AsyncStorage.setItem(DEV_GUEST_KEY, 'true');
  return DEV_GUEST_USER;
}

export async function clearDevGuestSession(): Promise<void> {
  await AsyncStorage.removeItem(DEV_GUEST_KEY);
}

/** Send a one-time passcode to the user's email. */
export async function requestEmailOtp(email: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      message:
        'Supabase is not configured. Copy .env.example to .env and add your project URL and anon key, or continue without signing in.',
    };
  }

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });

  if (error) {
    return { ok: false, message: formatAuthError(error.message) };
  }

  return {
    ok: true,
    message: `We sent a 6-digit code to ${email}. Enter it below to sign in.`,
  };
}

/** Verify the email OTP and establish a persisted session. */
export async function verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const code = token.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'Enter the 6-digit code from your email.' };
  }

  const { error } = await client.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });

  if (error) {
    return { ok: false, message: formatAuthError(error.message) };
  }

  return { ok: true, message: 'Signed in.' };
}

export async function signOut(): Promise<void> {
  await clearDevGuestSession();
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}
