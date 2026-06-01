import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabaseConfig } from '../../config/env';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

export async function getAccessToken(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
