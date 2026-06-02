import { seededBooks } from '../../data/mockChapter';
import { getBundledSyncAsset } from '../../data/bundledSyncAssets';
import type { Book, BookCatalogItem, Chapter } from '../../types';
import { hashSyncAsset, syncAssetToChapter } from '../../utils/syncAsset';
import { loadChapterSyncAsset } from '../sync/cache';
import { hasSupabaseConfig } from '../../config/env';
import { getContentSources } from '../../store/useContentStore';
import {
  fetchBooksFromOpenLibrary,
  fetchCatalogFromOpenLibrary,
} from '../openLibrary/openLibraryService';
import {
  fetchBooksFromSupabase,
  fetchChapterFromSupabase,
  fetchReadableBookSlugsFromSupabase,
} from './supabaseContent';
import { useContentStore } from '../../store/useContentStore';
import {
  fetchMockChapter,
  getMockBookMetadata,
  isBookReadable,
  isMockReadableBook,
} from './mockContentService';

export interface ChapterResponse {
  book: Book;
  chapter: Chapter;
}

export class ChapterNotFoundError extends Error {
  constructor(bookSlug: string, chapterSlug: string) {
    super(`Chapter not found: ${bookSlug}/${chapterSlug}`);
    this.name = 'ChapterNotFoundError';
  }
}

const LEGACY_BOOK_SLUGS = new Set(seededBooks.map((b) => b.slug));

const chapterCache = new Map<string, ChapterResponse>();

function chapterCacheKey(bookSlug: string, chapterSlug: string, textSource: string): string {
  return `${textSource}:${bookSlug}:${chapterSlug}`;
}

export function clearChapterCache(): void {
  chapterCache.clear();
}

function mapCatalogFromSeed(): BookCatalogItem[] {
  return seededBooks.map((book) => ({
    slug: book.slug,
    title: book.title,
    author: book.author,
    coverImageUrl: book.coverImageUrl,
  }));
}

async function hydrateChapterFromSeed(book: Book, chapter: Chapter): Promise<Chapter> {
  const bundled = getBundledSyncAsset(chapter);
  const syncHash = hashSyncAsset(bundled);
  const { asset } = await loadChapterSyncAsset(chapter.slug, {
    syncHash,
    syncVersion: bundled.sync_version,
    bundledAsset: bundled,
  });

  return syncAssetToChapter(asset, {
    bookSlug: book.slug,
    title: chapter.title,
    chapterIndex: chapter.chapterIndex,
    pageNumber: chapter.pageNumber,
    audioPath: chapter.audioPath,
    syncMetadataPath: chapter.syncMetadataPath,
    syncHash,
    durationMs: chapter.durationMs,
  });
}

async function fetchChapterFromSeed(
  bookSlug: string,
  chapterSlug: string,
): Promise<ChapterResponse> {
  const book = seededBooks.find((entry) => entry.slug === bookSlug);
  if (!book) {
    throw new ChapterNotFoundError(bookSlug, chapterSlug);
  }

  const chapter =
    book.chapters.find((entry) => entry.slug === chapterSlug) ?? book.chapters[0];
  if (!chapter) {
    throw new ChapterNotFoundError(bookSlug, chapterSlug);
  }

  const hydrated = await hydrateChapterFromSeed(book, chapter);
  return { book, chapter: hydrated };
}

export function canReadBook(bookSlug: string): boolean {
  const { textSource } = getContentSources();
  const supabaseSlugs = useContentStore.getState().readableBookSlugs;
  return isBookReadable(bookSlug, textSource, LEGACY_BOOK_SLUGS, supabaseSlugs);
}

export async function refreshReadableBookSlugs(): Promise<void> {
  const { textSource } = getContentSources();

  if (textSource === 'mock-json') {
    useContentStore
      .getState()
      .setReadableBookSlugs(isMockReadableBook(getMockBookMetadata().slug) ? [getMockBookMetadata().slug] : []);
    return;
  }

  if (textSource === 'legacy-seed') {
    useContentStore.getState().setReadableBookSlugs([...LEGACY_BOOK_SLUGS]);
    return;
  }

  if (textSource === 'supabase' && hasSupabaseConfig()) {
    const slugs = await fetchReadableBookSlugsFromSupabase();
    useContentStore.getState().setReadableBookSlugs(slugs ?? []);
    return;
  }

  useContentStore.getState().setReadableBookSlugs([]);
}

export async function fetchCatalog(): Promise<BookCatalogItem[]> {
  const { catalogSource } = getContentSources();

  if (catalogSource === 'openlibrary') {
    const remote = await fetchCatalogFromOpenLibrary();
    if (remote.length > 0) return remote;
  }

  return mapCatalogFromSeed();
}

export async function fetchBooks(): Promise<Book[]> {
  const { catalogSource } = getContentSources();

  if (catalogSource === 'openlibrary') {
    const remote = await fetchBooksFromOpenLibrary();
    if (remote.length > 0) return remote;
  }

  if (hasSupabaseConfig()) {
    const supabaseBooks = await fetchBooksFromSupabase();
    if (supabaseBooks?.length) return supabaseBooks;
  }

  return seededBooks;
}

export async function fetchChapter(
  bookSlug: string,
  chapterSlug: string,
): Promise<ChapterResponse> {
  const { textSource } = getContentSources();
  const cacheKey = chapterCacheKey(bookSlug, chapterSlug, textSource);
  const cached = chapterCache.get(cacheKey);
  if (cached) return cached;

  let result: ChapterResponse | null = null;

  if (textSource === 'mock-json' && isMockReadableBook(bookSlug)) {
    result = (await fetchMockChapter(bookSlug, chapterSlug)) ?? null;
  } else if (textSource === 'supabase' && hasSupabaseConfig()) {
    result = (await fetchChapterFromSupabase(bookSlug, chapterSlug)) ?? null;
  } else if (textSource === 'legacy-seed') {
    result = await fetchChapterFromSeed(bookSlug, chapterSlug);
  }

  if (!result) {
    throw new ChapterNotFoundError(bookSlug, chapterSlug);
  }

  chapterCache.set(cacheKey, result);
  return result;
}

/** Warm the in-memory cache (e.g. next/previous chapter while reading). */
export function prefetchChapter(bookSlug: string, chapterSlug: string): void {
  void fetchChapter(bookSlug, chapterSlug).catch(() => {
    /* ignore background prefetch errors */
  });
}

export async function reloadCatalog(): Promise<{ catalog: BookCatalogItem[]; books: Book[] }> {
  await refreshReadableBookSlugs();
  const [catalog, books] = await Promise.all([fetchCatalog(), fetchBooks()]);
  return { catalog, books };
}
