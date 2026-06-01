import * as Linking from 'expo-linking';

/**
 * OAuth redirect URL (Google/Apple) — not used by email OTP.
 * Configure in Supabase → Authentication → URL Configuration when adding OAuth.
 */
export function getAuthRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}
