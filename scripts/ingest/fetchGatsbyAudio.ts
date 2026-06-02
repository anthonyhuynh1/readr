/**
 * Download LibriVox Gatsby chapter 1 for Phase 3 audio demo.
 * Run: npm run fetch:gatsby-audio
 */
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const OUT_DIR = join(process.cwd(), 'assets', 'audio');
const OUT_FILE = join(OUT_DIR, 'gatsby-ch1-librivox.mp3');

/** Kara Shallenberg reading — matches mockBook Gatsby edition on LibriVox. */
const LIBRIVOX_CH1_URL =
  'https://archive.org/download/greatgatsby_2101_librivox/greatgatsby_01_fitzgerald_128kb.mp3';

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Downloading LibriVox Gatsby chapter 1…');
  console.log(LIBRIVOX_CH1_URL);

  const res = await fetch(LIBRIVOX_CH1_URL, {
    redirect: 'follow',
    headers: { 'User-Agent': 'readr-ingest/1.0 (local dev)' },
  });

  if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
  }

  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(OUT_FILE));

  if (!existsSync(OUT_FILE)) {
    throw new Error('Download completed but file missing');
  }

  console.log(`\n✓ Saved ${OUT_FILE}`);
  console.log('\nNext: npm run seed:supabase');
  console.log('Then Profile → Audio → On, open Gatsby ch.1, tap Play.');
  console.log(
    '\nNote: LibriVox starts with a short spoken intro — karaoke may need offset tuning or WhisperX alignment.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
