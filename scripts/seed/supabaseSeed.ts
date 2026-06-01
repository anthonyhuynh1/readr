/**
 * Seed Supabase with catalog, sync JSON, covers, and demo audio.
 *
 * Primary source: src/mocks/mockBook.json (ingest pipeline output).
 * Legacy seededBooks remain available via --legacy flag.
 *
 * Requires in .env (or environment):
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: npm run seed:supabase
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { seededBooks, getBundledSyncAsset } from '../../src/data/mockChapter';
import { getBookCoverUrl } from '../../src/data/bookCovers';
import {
  buildChapterFromParagraphs,
  DEFAULT_LIBRIVOX_OFFSET_MS,
} from '../../src/utils/chapterBuilder';
import { chapterToSyncAsset, hashSyncAsset } from '../../src/utils/syncAsset';
import { hashTextAsset } from '../../src/utils/textAsset';
import type { ChapterTextAsset } from '../../src/types/chapterTextAsset';
import type { Book, Chapter } from '../../src/types';

interface MockBookChapterDef {
  slug: string;
  title: string;
  chapterIndex: number;
  pageNumber: number;
  paragraphs: string[];
}

interface MockBookFile {
  schema_version: number;
  slug: string;
  title: string;
  author: string;
  description?: string;
  standardEbooksUrl?: string;
  librivoxUrl?: string;
  openLibraryWorkId?: string;
  chapters: MockBookChapterDef[];
}

function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceKey) {
  console.error(
    'Missing SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_AUDIO = join(process.cwd(), 'assets', 'audio', 'demo-chapter.mp3');
const MOCK_BOOK_PATH = join(process.cwd(), 'src', 'mocks', 'mockBook.json');
const useLegacy = process.argv.includes('--legacy');

async function uploadFile(
  bucket: string,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    upsert: true,
    contentType,
  });
  if (error) throw new Error(`Upload ${bucket}/${path}: ${error.message}`);
}

async function fetchCoverBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function loadMockBook(): MockBookFile {
  const raw = readFileSync(MOCK_BOOK_PATH, 'utf8');
  const data = JSON.parse(raw) as MockBookFile;
  if (data.schema_version !== 1) {
    throw new Error(`Unsupported mockBook schema_version: ${data.schema_version}`);
  }
  return data;
}

function buildChapterFromMockDef(bookSlug: string, def: MockBookChapterDef): Chapter {
  return buildChapterFromParagraphs({
    slug: def.slug,
    bookSlug,
    title: def.title,
    chapterIndex: def.chapterIndex,
    pageNumber: def.pageNumber,
    audioPath: `audio/${bookSlug}/ch-${def.chapterIndex}.mp3`,
    syncMetadataPath: `sync/${bookSlug}/ch-${def.chapterIndex}.json`,
    audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
    paragraphs: def.paragraphs,
  });
}

async function seedBook(
  book: Pick<Book, 'slug' | 'title' | 'author' | 'description' | 'standardEbooksUrl' | 'librivoxUrl' | 'coverImageUrl'>,
  chapters: Chapter[],
  uploadDemoAudioForFirstChapter: boolean,
): Promise<void> {
  const coverUrl = getBookCoverUrl(book.slug) ?? book.coverImageUrl;
  let coverStoragePath = `${book.slug}/cover.jpg`;

  const coverBuf = await fetchCoverBuffer(coverUrl);
  if (coverBuf) {
    await uploadFile('covers', coverStoragePath, coverBuf, 'image/jpeg');
  } else {
    coverStoragePath = coverUrl;
  }

  const { error: bookError } = await supabase.from('books').upsert(
    {
      slug: book.slug,
      title: book.title,
      author: book.author,
      cover_url: coverStoragePath.startsWith('http')
        ? coverStoragePath
        : supabaseUrl.replace(/\/$/, '') +
          `/storage/v1/object/public/covers/${coverStoragePath}`,
      description: book.description,
      standard_ebooks_url: book.standardEbooksUrl,
      librivox_url: book.librivoxUrl,
    },
    { onConflict: 'slug' },
  );
  if (bookError) throw bookError;

  for (const chapter of chapters) {
    const textAsset: ChapterTextAsset = {
      schema_version: 1,
      chapter_slug: chapter.slug,
      sentences: chapter.sentences.map((sentence) => ({
        id: sentence.id,
        index: sentence.index,
        text: sentence.text,
        page_number: sentence.pageNumber,
      })),
    };
    const textHash = hashTextAsset(textAsset);
    const textPath = `${book.slug}/ch-${chapter.chapterIndex}.json`;
    const textJson = Buffer.from(JSON.stringify(textAsset), 'utf8');
    await uploadFile('text', textPath, textJson, 'application/json');

    const asset = chapterToSyncAsset(chapter);
    asset.sync_hash = hashSyncAsset(asset);
    const syncPath = chapter.syncMetadataPath.replace(/^sync\//, '');
    const syncJson = Buffer.from(JSON.stringify(asset), 'utf8');
    await uploadFile('sync', syncPath, syncJson, 'application/json');

    const audioStoragePath = chapter.audioPath.replace(/^audio\//, '');
    if (uploadDemoAudioForFirstChapter && chapter.chapterIndex === 1 && existsSync(DEMO_AUDIO)) {
      const audioBuf = readFileSync(DEMO_AUDIO);
      await uploadFile('audio', audioStoragePath, audioBuf, 'audio/mpeg');
    }

    const { error: chapterError } = await supabase.from('chapters').upsert(
      {
        slug: chapter.slug,
        book_slug: book.slug,
        chapter_index: chapter.chapterIndex,
        title: chapter.title,
        page_number: chapter.pageNumber,
        audio_path: audioStoragePath,
        sync_metadata_path: syncPath,
        text_metadata_path: textPath,
        text_hash: textHash,
        text_version: 1,
        audio_offset_ms: chapter.audioOffsetMs,
        sync_hash: chapter.syncHash || asset.sync_hash,
        sync_version: chapter.syncVersion,
        duration_ms: chapter.durationMs,
      },
      { onConflict: 'slug' },
    );
    if (chapterError) throw chapterError;

    for (const sentence of chapter.sentences) {
      const first = sentence.words[0];
      const last = sentence.words[sentence.words.length - 1];
      const { error: sentenceError } = await supabase.from('sentences').upsert(
        {
          id: sentence.id,
          chapter_slug: chapter.slug,
          sentence_index: sentence.index,
          text_content: sentence.text,
          start_time_ms: first?.start_ms ?? 0,
          end_time_ms: last?.end_ms ?? 0,
          page_number: sentence.pageNumber,
        },
        { onConflict: 'id' },
      );
      if (sentenceError) throw sentenceError;
    }

    console.log(`  ✓ ${chapter.slug}`);
  }
}

async function seedFromMockBook(): Promise<void> {
  const mockBook = loadMockBook();
  const chapters = mockBook.chapters.map((def) => buildChapterFromMockDef(mockBook.slug, def));

  await seedBook(
    {
      slug: mockBook.slug,
      title: mockBook.title,
      author: mockBook.author,
      description: mockBook.description ?? '',
      standardEbooksUrl: mockBook.standardEbooksUrl ?? '',
      librivoxUrl: mockBook.librivoxUrl ?? '',
      coverImageUrl: '',
    },
    chapters,
    true,
  );
}

async function seedFromLegacyBooks(): Promise<void> {
  for (const book of seededBooks) {
    const chapters = book.chapters.map((chapter) => {
      const asset = getBundledSyncAsset(chapter);
      asset.sync_hash = hashSyncAsset(asset);
      return chapter;
    });
    await seedBook(book, chapters, true);
  }
}

async function main(): Promise<void> {
  console.log('Seeding Readr catalog to Supabase…');

  if (useLegacy) {
    console.log('Using legacy seededBooks (--legacy)');
    await seedFromLegacyBooks();
  } else {
    console.log(`Using ${MOCK_BOOK_PATH}`);
    await seedFromMockBook();
  }

  const assetsSyncDir = join(process.cwd(), 'assets', 'sync');
  if (existsSync(assetsSyncDir)) {
    for (const bookDir of readdirSync(assetsSyncDir, { withFileTypes: true })) {
      if (!bookDir.isDirectory()) continue;
      const bookPath = join(assetsSyncDir, bookDir.name);
      for (const file of readdirSync(bookPath)) {
        if (!file.endsWith('.json')) continue;
        const full = join(bookPath, file);
        const syncPath = `${bookDir.name}/${file}`;
        await uploadFile('sync', syncPath, readFileSync(full), 'application/json');
      }
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
