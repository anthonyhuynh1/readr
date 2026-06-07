import { getBookCoverUrl } from '../../data/bookCovers';
import { getBundledSyncAssetBySlug } from '../../data/bundledSyncAssets';
import { env, hasSupabaseConfig } from '../../config/env';
import { getSupabaseClient } from '../supabase/client';
import { loadChapterSyncAsset } from '../sync/cache';
import { loadChapterTextAsset } from '../sync/textCache';
import { syncAssetToChapter } from '../../utils/syncAsset';
import { textAssetToChapter } from '../../utils/textAsset';
import type { Book, BookCatalogItem, Chapter } from '../../types';
import type { ChapterSyncAsset } from '../../types/syncAsset';

interface DbBook {
  slug: string;
  title: string;
  author: string;
  cover_url: string | null;
  description: string;
  standard_ebooks_url: string;
  librivox_url: string;
}

interface DbChapter {
  slug: string;
  book_slug: string;
  chapter_index: number;
  title: string;
  page_number: number;
  audio_path: string;
  sync_metadata_path: string;
  text_metadata_path: string;
  text_hash: string;
  text_version: number;
  audio_offset_ms: number;
  sync_hash: string;
  sync_version: number;
  duration_ms: number;
}

function emptySyncAsset(chapter: DbChapter): ChapterSyncAsset {
  return {
    schema_version: 1,
    chapter_slug: chapter.slug,
    sync_version: chapter.sync_version,
    audio_offset_ms: chapter.audio_offset_ms,
    sentences: [],
  };
}

export function getStoragePublicUrl(bucket: string, path: string): string {
  const base = env.supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

function mapDbBook(row: DbBook, chapters: Chapter[]): Book {
  return {
    slug: row.slug,
    title: row.title,
    author: row.author,
    description: row.description,
    coverImageUrl: row.cover_url ?? getBookCoverUrl(row.slug) ?? '',
    standardEbooksUrl: row.standard_ebooks_url,
    librivoxUrl: row.librivox_url,
    chapters,
  };
}

function mapDbChapter(row: DbChapter): Omit<Chapter, 'sentences'> {
  return {
    slug: row.slug,
    bookSlug: row.book_slug,
    title: row.title,
    chapterIndex: row.chapter_index,
    pageNumber: row.page_number,
    durationMs: row.duration_ms,
    audioPath: row.audio_path,
    syncMetadataPath: row.sync_metadata_path,
    audioOffsetMs: row.audio_offset_ms,
    syncHash: row.sync_hash,
    syncVersion: row.sync_version,
    textMetadataPath: row.text_metadata_path || undefined,
    textHash: row.text_hash || undefined,
  };
}

async function applySyncTimings(
  chapter: Chapter,
  dbChapter: DbChapter,
  bookSlug: string,
): Promise<Chapter> {
  if (!dbChapter.sync_hash) return chapter;

  const syncUrl = getStoragePublicUrl('sync', dbChapter.sync_metadata_path);
  const { asset } = await loadChapterSyncAsset(dbChapter.slug, {
    syncHash: dbChapter.sync_hash,
    syncVersion: dbChapter.sync_version,
    bundledAsset:
      getBundledSyncAssetBySlug(dbChapter.slug) ?? emptySyncAsset(dbChapter),
    remoteUrl: syncUrl,
  });

  if (asset.sentences.length === 0) return chapter;

  return syncAssetToChapter(
    { ...asset, audio_offset_ms: asset.audio_offset_ms },
    {
    bookSlug,
    title: dbChapter.title,
    chapterIndex: dbChapter.chapter_index,
    pageNumber: dbChapter.page_number,
    audioPath: dbChapter.audio_path,
    syncMetadataPath: dbChapter.sync_metadata_path,
    syncHash: dbChapter.sync_hash,
    durationMs: dbChapter.duration_ms || undefined,
  });
}

async function hydrateChapterFromSupabase(
  dbChapter: DbChapter,
  bookSlug: string,
): Promise<Chapter | null> {
  if (!dbChapter.text_metadata_path || !dbChapter.text_hash) return null;

  const textUrl = getStoragePublicUrl('text', dbChapter.text_metadata_path);
  const { asset } = await loadChapterTextAsset(dbChapter.slug, {
    textHash: dbChapter.text_hash,
    textVersion: dbChapter.text_version,
    remoteUrl: textUrl,
  });

  if (asset.sentences.length === 0) return null;

  let chapter = textAssetToChapter(asset, {
    bookSlug,
    title: dbChapter.title,
    chapterIndex: dbChapter.chapter_index,
    pageNumber: dbChapter.page_number,
    audioPath: dbChapter.audio_path,
    syncMetadataPath: dbChapter.sync_metadata_path,
    textMetadataPath: dbChapter.text_metadata_path,
    audioOffsetMs: dbChapter.audio_offset_ms,
    textHash: dbChapter.text_hash,
    syncHash: dbChapter.sync_hash,
    syncVersion: dbChapter.sync_version,
    durationMs: dbChapter.duration_ms || undefined,
  });

  // Load real WhisperX karaoke timings whenever the chapter has them, regardless
  // of audioEnabled — audioEnabled only controls whether audio playback is wired,
  // not whether word-level sync data is present.
  if (dbChapter.sync_hash) {
    chapter = await applySyncTimings(chapter, dbChapter, bookSlug);
  }

  return chapter;
}

export async function fetchReadableBookSlugsFromSupabase(): Promise<string[] | null> {
  const client = getSupabaseClient();
  if (!client || !hasSupabaseConfig()) return null;

  const { data, error } = await client
    .from('books')
    .select('slug')
    .order('title');

  if (error || !data?.length) return null;

  return data.map((row) => row.slug as string);
}

export async function fetchCatalogFromSupabase(): Promise<BookCatalogItem[] | null> {
  const client = getSupabaseClient();
  if (!client || !hasSupabaseConfig()) return null;

  const { data, error } = await client
    .from('books')
    .select('slug, title, author, cover_url')
    .order('title');

  if (error || !data?.length) return null;

  return data.map((row) => ({
    slug: row.slug,
    title: row.title,
    author: row.author,
    coverImageUrl: row.cover_url ?? getBookCoverUrl(row.slug) ?? '',
  }));
}

export async function fetchBooksFromSupabase(): Promise<Book[] | null> {
  const client = getSupabaseClient();
  if (!client || !hasSupabaseConfig()) return null;

  const { data: bookRows, error: bookError } = await client
    .from('books')
    .select('*')
    .order('title');

  if (bookError || !bookRows?.length) return null;

  const { data: chapterRows, error: chapterError } = await client
    .from('chapters')
    .select('*')
    .order('chapter_index');

  if (chapterError || !chapterRows) return null;

  const chaptersByBook = new Map<string, Chapter[]>();
  for (const row of chapterRows as DbChapter[]) {
    const list = chaptersByBook.get(row.book_slug) ?? [];
    list.push({ ...mapDbChapter(row), sentences: [] });
    chaptersByBook.set(row.book_slug, list);
  }

  return (bookRows as DbBook[]).map((row) =>
    mapDbBook(row, chaptersByBook.get(row.slug) ?? []),
  );
}

export async function fetchChapterFromSupabase(
  bookSlug: string,
  chapterSlug: string,
): Promise<{ book: Book; chapter: Chapter } | null> {
  const client = getSupabaseClient();
  if (!client || !hasSupabaseConfig()) return null;

  const { data: bookRow, error: bookError } = await client
    .from('books')
    .select('*')
    .eq('slug', bookSlug)
    .maybeSingle();

  if (bookError || !bookRow) return null;

  const { data: allChapters } = await client
    .from('chapters')
    .select('*')
    .eq('book_slug', bookSlug)
    .order('chapter_index');

  const { data: chapterRow, error: chapterError } = await client
    .from('chapters')
    .select('*')
    .eq('slug', chapterSlug)
    .maybeSingle();

  if (chapterError || !chapterRow) return null;

  const dbChapter = chapterRow as DbChapter;
  const hydrated = await hydrateChapterFromSupabase(dbChapter, bookSlug);
  if (!hydrated) return null;

  const bookChapters = ((allChapters ?? []) as DbChapter[]).map((row) => {
    if (row.slug === chapterSlug) return hydrated;
    return { ...mapDbChapter(row), sentences: [] } as Chapter;
  });

  const book = mapDbBook(bookRow as DbBook, bookChapters);
  return { book, chapter: hydrated };
}

export function resolveChapterAudioStorageUrl(audioPath: string): string {
  return getStoragePublicUrl('audio', audioPath);
}
