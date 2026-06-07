import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OPEN_LIBRARY_SLUG_OVERRIDES,
  OPEN_LIBRARY_WORK_IDS,
} from '../../config/openLibraryCatalog';
import type { Book, BookCatalogItem } from '../../types';
import { slugifyTitle } from '../../utils/slugify';

const CACHE_PREFIX = 'readr.ol.work.';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OL_BASE = 'https://openlibrary.org';

export type CoverSize = 'S' | 'M' | 'L';

interface CachedWorkEntry {
  fetchedAt: number;
  work: OpenLibraryWorkRecord;
}

export interface OpenLibraryWorkRecord {
  workId: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl: string;
  slug: string;
}

interface RawOlWork {
  title?: string;
  description?: string | { value?: string; type?: string };
  covers?: number[];
  authors?: Array<{ author?: { key?: string }; key?: string }>;
}

interface RawOlAuthor {
  name?: string;
}

export function buildCoverUrl(
  kind: 'id' | 'isbn' | 'olid',
  value: string | number,
  size: CoverSize = 'L',
): string {
  return `https://covers.openlibrary.org/b/${kind}/${value}-${size}.jpg`;
}

function parseDescription(raw: RawOlWork['description']): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return raw.value ?? '';
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchAuthorName(authorKey: string): Promise<string> {
  const key = authorKey.startsWith('/') ? authorKey : `/authors/${authorKey}`;
  const data = await fetchJson<RawOlAuthor>(`${OL_BASE}${key}.json`);
  return data?.name ?? 'Unknown author';
}

async function readCachedWork(workId: string): Promise<OpenLibraryWorkRecord | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${workId}`);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CachedWorkEntry;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.work;
  } catch {
    return null;
  }
}

async function writeCachedWork(workId: string, work: OpenLibraryWorkRecord): Promise<void> {
  const entry: CachedWorkEntry = { fetchedAt: Date.now(), work };
  await AsyncStorage.setItem(`${CACHE_PREFIX}${workId}`, JSON.stringify(entry));
}

export async function fetchWork(workId: string): Promise<OpenLibraryWorkRecord | null> {
  const cached = await readCachedWork(workId);
  if (cached) return cached;

  const data = await fetchJson<RawOlWork>(`${OL_BASE}/works/${workId}.json`);
  if (!data?.title) return null;

  const authorRef = data.authors?.[0];
  const authorKey = authorRef?.author?.key ?? authorRef?.key;
  const author = authorKey ? await fetchAuthorName(authorKey) : 'Unknown author';

  const slugOverride = OPEN_LIBRARY_SLUG_OVERRIDES[workId as keyof typeof OPEN_LIBRARY_SLUG_OVERRIDES];
  const slug = slugOverride ?? slugifyTitle(data.title);

  const coverId = data.covers?.[0];
  const coverImageUrl = coverId ? buildCoverUrl('id', coverId, 'L') : '';

  const work: OpenLibraryWorkRecord = {
    workId,
    title: data.title,
    author,
    description: parseDescription(data.description),
    coverImageUrl,
    slug,
  };

  await writeCachedWork(workId, work);
  return work;
}

export async function fetchWorksByIds(
  workIds: readonly string[] = OPEN_LIBRARY_WORK_IDS,
): Promise<OpenLibraryWorkRecord[]> {
  const results = await Promise.all(workIds.map((id) => fetchWork(id)));
  return results.filter((entry): entry is OpenLibraryWorkRecord => entry !== null);
}

export function mapWorkToCatalogItem(work: OpenLibraryWorkRecord): BookCatalogItem {
  return {
    slug: work.slug,
    title: work.title,
    author: work.author,
    coverImageUrl: work.coverImageUrl,
    openLibraryWorkId: work.workId,
  };
}

export async function fetchCatalogFromOpenLibrary(): Promise<BookCatalogItem[]> {
  const works = await fetchWorksByIds();
  return works.map(mapWorkToCatalogItem);
}

export async function fetchBooksFromOpenLibrary(): Promise<Book[]> {
  const works = await fetchWorksByIds();

  // Discovery metadata only — chapter lists for readable books come from Supabase.
  return works.map((work) => ({
    slug: work.slug,
    title: work.title,
    author: work.author,
    description: work.description,
    coverImageUrl: work.coverImageUrl,
    standardEbooksUrl: '',
    librivoxUrl: '',
    openLibraryWorkId: work.workId,
    chapters: [],
  }));
}
