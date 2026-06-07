import type { Book, BookCatalogItem, Chapter } from '../../types';
import { hasSupabaseConfig } from '../../config/env';
import { useContentStore } from '../../store/useContentStore';
import {
  fetchBooksFromOpenLibrary,
  fetchCatalogFromOpenLibrary,
} from '../openLibrary/openLibraryService';
import {
  fetchBooksFromSupabase,
  fetchCatalogFromSupabase,
  fetchChapterFromSupabase,
  fetchReadableBookSlugsFromSupabase,
} from './supabaseContent';

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

const chapterCache = new Map<string, ChapterResponse>();

function chapterCacheKey(bookSlug: string, chapterSlug: string): string {
  return `${bookSlug}:${chapterSlug}`;
}

export function clearChapterCache(): void {
  chapterCache.clear();
}

/** A book is readable when Supabase has seeded its chapters/text. */
export function canReadBook(bookSlug: string): boolean {
  return useContentStore.getState().readableBookSlugs.includes(bookSlug);
}

export async function refreshReadableBookSlugs(): Promise<void> {
  if (hasSupabaseConfig()) {
    const slugs = await fetchReadableBookSlugsFromSupabase();
    useContentStore.getState().setReadableBookSlugs(slugs ?? []);
    return;
  }
  useContentStore.getState().setReadableBookSlugs([]);
}

export async function fetchCatalog(): Promise<BookCatalogItem[]> {
  // Open Library is the discovery catalog (real external data source).
  const remote = await fetchCatalogFromOpenLibrary();
  if (remote.length > 0) return remote;

  // Fall back to the Supabase catalog when Open Library is unreachable.
  if (hasSupabaseConfig()) {
    const supabase = await fetchCatalogFromSupabase();
    if (supabase?.length) return supabase;
  }

  return [];
}

export async function fetchBooks(): Promise<Book[]> {
  // Supabase books carry real chapter lists (readable); Open Library books are
  // discovery-only (browse, no chapters). Supabase wins on slug collisions.
  const supabaseBooks = hasSupabaseConfig()
    ? (await fetchBooksFromSupabase()) ?? []
    : [];
  const seen = new Set(supabaseBooks.map((b) => b.slug));
  const merged: Book[] = [...supabaseBooks];

  const discovery = await fetchBooksFromOpenLibrary();
  for (const book of discovery) {
    if (!seen.has(book.slug)) {
      merged.push(book);
      seen.add(book.slug);
    }
  }

  return merged;
}

export async function fetchChapter(
  bookSlug: string,
  chapterSlug: string,
): Promise<ChapterResponse> {
  const cacheKey = chapterCacheKey(bookSlug, chapterSlug);
  const cached = chapterCache.get(cacheKey);
  if (cached) return cached;

  if (!hasSupabaseConfig()) {
    throw new ChapterNotFoundError(bookSlug, chapterSlug);
  }

  const result = await fetchChapterFromSupabase(bookSlug, chapterSlug);
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
