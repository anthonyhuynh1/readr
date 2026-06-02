import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(): Record<string, string> {
  const envPath = join(process.cwd(), '.env');
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function keyKind(value: string): string {
  if (!value) return 'empty';
  if (value.startsWith('sb_publishable_')) return 'publishable (ok for app)';
  if (value.startsWith('sb_secret_')) return 'secret (seed scripts only — wrong var for app)';
  if (value.startsWith('eyJ')) return 'legacy-jwt (disabled if you turned off legacy keys)';
  return 'unknown format';
}

const env = loadEnv();
const vars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

console.log('Readr .env key check\n');
for (const name of vars) {
  const value = env[name] ?? '';
  console.log(`${name}: ${keyKind(value)}`);
}

const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (anon.startsWith('eyJ')) {
  console.log('\n→ Fix: Dashboard → Settings → API Keys → copy Publishable key');
  console.log('  into EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo (npx expo start -c).');
  process.exit(1);
}

if (anon.startsWith('sb_secret_')) {
  console.log('\n→ Fix: You put the Secret key in the anon slot. Use Publishable for the app.');
  process.exit(1);
}

if (!anon.startsWith('sb_publishable_')) {
  console.log('\n→ Set EXPO_PUBLIC_SUPABASE_ANON_KEY to your sb_publishable_... key.');
  process.exit(1);
}

console.log('\n✓ App key format looks correct. Restart Expo if login still fails.');
