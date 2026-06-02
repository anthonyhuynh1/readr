import mockBookJson from '../../mocks/mockBook.json';
import { getBundledSyncAsset } from '../../data/bundledSyncAssets';
import type { Book, Chapter } from '../../types';
import {
  buildChapterFromParagraphs,
  DEFAULT_LIBRIVOX_OFFSET_MS,
} from '../../utils/chapterBuilder';
import { hashSyncAsset, syncAssetToChapter } from '../../utils/syncAsset';
import { loadChapterSyncAsset } from '../sync/cache';

export interface MockBookChapterDef {
  slug: string;
  title: string;
  chapterIndex: number;
  pageNumber: number;
  paragraphs: string[];
}

export interface MockBookFile {
  schema_version: number;
  slug: string;
  openLibraryWorkId?: string;
  title: string;
  author: string;
  description?: string;
  standardEbooksUrl?: string;
  librivoxUrl?: string;
  chapters: MockBookChapterDef[];
}

const mockBook = mockBookJson as MockBookFile;

function assertMockBook(data: MockBookFile): void {
  if (data.schema_version !== 1) {
    throw new Error(`Unsupported mockBook schema_version: ${data.schema_version}`);
  }
}

assertMockBook(mockBook);

export interface ChapterResponse {
  book: Book;
  chapter: Chapter;
}

function buildChapterStub(def: MockBookChapterDef, bookSlug: string): Chapter {
  return {
    slug: def.slug,
    bookSlug,
    title: def.title,
    chapterIndex: def.chapterIndex,
    pageNumber: def.pageNumber,
    durationMs: 0,
    sentences: [],
    audioPath: `audio/${bookSlug}/ch-${def.chapterIndex}.mp3`,
    syncMetadataPath: `sync/${bookSlug}/ch-${def.chapterIndex}.json`,
    audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
    syncHash: '',
    syncVersion: 1,
  };
}

function buildFullChapter(def: MockBookChapterDef, bookSlug: string): Chapter {
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

export function getMockBookMetadata(): MockBookFile {
  return mockBook;
}

export function isMockReadableBook(slug: string): boolean {
  return mockBook.slug === slug;
}

export function getMockChapterCount(): number {
  return mockBook.chapters.length;
}

export function getMockChapterStubs(): Chapter[] {
  return mockBook.chapters.map((def) => buildChapterStub(def, mockBook.slug));
}

export function getMockBook(): Book {
  return {
    slug: mockBook.slug,
    title: mockBook.title,
    author: mockBook.author,
    description: mockBook.description ?? '',
    coverImageUrl: '',
    standardEbooksUrl: mockBook.standardEbooksUrl ?? '',
    librivoxUrl: mockBook.librivoxUrl ?? '',
    openLibraryWorkId: mockBook.openLibraryWorkId,
    chapters: getMockChapterStubs(),
  };
}

async function hydrateChapter(book: Book, chapter: Chapter): Promise<Chapter> {
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

export async function fetchMockChapter(
  bookSlug: string,
  chapterSlug: string,
): Promise<ChapterResponse | null> {
  if (!isMockReadableBook(bookSlug)) return null;

  const def =
    mockBook.chapters.find((c) => c.slug === chapterSlug) ?? mockBook.chapters[0];
  if (!def) return null;

  const book = getMockBook();
  const built = buildFullChapter(def, mockBook.slug);
  const hydrated = await hydrateChapter(book, built);

  const bookWithChapters: Book = {
    ...book,
    chapters: mockBook.chapters.map((ch) =>
      ch.slug === def.slug ? hydrated : buildChapterStub(ch, mockBook.slug),
    ),
  };

  return { book: bookWithChapters, chapter: hydrated };
}

/** Whether this book slug has readable text for the current text source. */
export function isBookReadable(
  bookSlug: string,
  textSource: 'mock-json' | 'legacy-seed' | 'supabase',
  legacySlugs: Set<string>,
  supabaseSlugs?: readonly string[],
): boolean {
  if (textSource === 'mock-json') return isMockReadableBook(bookSlug);
  if (textSource === 'legacy-seed') return legacySlugs.has(bookSlug);
  if (textSource === 'supabase') return supabaseSlugs?.includes(bookSlug) ?? false;
  return false;
}
