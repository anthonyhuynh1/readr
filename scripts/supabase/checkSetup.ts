/**
 * Check Supabase project readiness for Readr seed + app.
 * Run: npm run supabase:check
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function isLegacyDisabledError(message: string): boolean {
  return message.toLowerCase().includes('legacy api keys are disabled');
}

function printLegacyKeyHelp(): void {
  console.log('  Dashboard → Project Settings → API Keys');
  console.log('  • App client: copy Publishable key → EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.log('  • Seed scripts: copy Secret key → SUPABASE_SERVICE_ROLE_KEY');
  console.log('  Legacy JWT anon/service_role keys stop working once disabled.\n');
}

function adminClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

loadEnvFile();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function main(): Promise<void> {
  console.log('Readr Supabase setup check\n');

  if (!url) {
    console.error('✗ Missing EXPO_PUBLIC_SUPABASE_URL in .env');
    process.exit(1);
  }
  console.log(`✓ Project URL configured (${new URL(url).hostname})`);

  if (!publishableKey) {
    console.error('✗ Missing EXPO_PUBLIC_SUPABASE_ANON_KEY (publishable key) in .env');
    printLegacyKeyHelp();
    process.exit(1);
  }
  console.log('✓ Publishable / anon key configured');

  if (!secretKey) {
    console.log('✗ SUPABASE_SERVICE_ROLE_KEY missing — required for npm run seed:supabase');
    printLegacyKeyHelp();
  } else {
    console.log('✓ Secret / service role key configured');
  }

  const appClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: appPingErr } = await appClient.from('books').select('slug').limit(1);
  if (appPingErr) {
    console.log(`✗ App publishable key: ${appPingErr.message}`);
    if (isLegacyDisabledError(appPingErr.message)) {
      printLegacyKeyHelp();
    }
  } else {
    console.log('✓ App publishable key can read catalog');
  }

  if (!secretKey) {
    process.exit(1);
  }

  const db = adminClient(url, secretKey);

  const tables = ['books', 'chapters', 'sentences', 'user_highlights'] as const;
  let schemaOk = true;

  for (const table of tables) {
    const { error } = await db.from(table).select('*').limit(1);
    if (error) {
      console.log(`✗ Table public.${table}: ${error.message}`);
      if (isLegacyDisabledError(error.message)) {
        printLegacyKeyHelp();
      }
      schemaOk = false;
    } else {
      console.log(`✓ Table public.${table} reachable`);
    }
  }

  const { error: textColErr } = await db
    .from('chapters')
    .select('text_metadata_path, text_hash')
    .limit(1);

  if (textColErr) {
    console.log(`✗ chapters.text_metadata_path column: ${textColErr.message}`);
    console.log('  Run supabase/setup_fresh_project.sql (includes migration 004).');
    schemaOk = false;
  } else {
    console.log('✓ chapters text storage columns present');
  }

  const { data: bookRow, error: bookErr } = await db
    .from('books')
    .select('slug')
    .eq('slug', 'the-great-gatsby')
    .maybeSingle();

  if (bookErr) {
    console.log(`✗ Catalog check: ${bookErr.message}`);
  } else if (bookRow) {
    console.log('✓ Gatsby seeded in books table');
  } else {
    console.log('○ Gatsby not seeded yet — run npm run seed:supabase after migrations');
  }

  if (!schemaOk) {
    console.log('\n→ Run supabase/setup_fresh_project.sql in the SQL Editor, then re-check.');
    console.log('  https://supabase.com/dashboard/project/_/sql/new');
    process.exit(1);
  }

  if (!bookRow) {
    console.log('\n→ Ready to seed: npm run seed:supabase');
    process.exit(0);
  }

  console.log('\n✓ Setup looks good. Restart the app to read from Supabase.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
