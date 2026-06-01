const EMPTY = '';

function readEnv(name: string): string {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : EMPTY;
}

export const env = {
  supabaseUrl: readEnv('EXPO_PUBLIC_SUPABASE_URL'),
  /** Legacy name; value should be sb_publishable_... or legacy anon JWT. */
  supabaseAnonKey:
    readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
    readEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  apiBaseUrl: readEnv('EXPO_PUBLIC_API_BASE_URL'),
  askAiFallbackEnabled:
    readEnv('EXPO_PUBLIC_ASK_AI_FALLBACK').toLowerCase() !== 'false',
};

export function hasSupabaseConfig(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/** True when the app should prefer Supabase over local mock fallbacks. */
export function isBackendConfigured(): boolean {
  return hasSupabaseConfig();
}

export function hasApiBaseUrl(): boolean {
  return Boolean(env.apiBaseUrl);
}

/** Allow local guest session while developing (even when Supabase is configured). */
export function canUseDevGuestBypass(): boolean {
  return !hasSupabaseConfig() || __DEV__;
}
