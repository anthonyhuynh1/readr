import type { Book, Chapter } from '../types';

/**
 * Neutral, content-free placeholders used as initial playback state before a
 * real book/chapter is loaded from Supabase. These are NOT mock data — they
 * carry no text/audio and are never displayed (the Read screen blocks on a
 * loader until the requested chapter is hydrated).
 */
export const EMPTY_CHAPTER: Chapter = {
  slug: '',
  bookSlug: '',
  title: '',
  chapterIndex: 0,
  pageNumber: 1,
  durationMs: 0,
  sentences: [],
  audioPath: '',
  syncMetadataPath: '',
  audioOffsetMs: 0,
  syncHash: '',
  syncVersion: 1,
};

export const EMPTY_BOOK: Book = {
  slug: '',
  title: '',
  author: '',
  description: '',
  coverImageUrl: '',
  standardEbooksUrl: '',
  librivoxUrl: '',
  chapters: [],
};
