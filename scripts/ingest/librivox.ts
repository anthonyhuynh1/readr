import type { Book } from '../../src/types';
import { seededBooks } from '../../src/data/mockChapter';

export interface LibrivoxChapterAudio {
  book_slug: string;
  chapter_slug: string;
  chapter_index: number;
  chapter_title: string;
  librivox_catalog_url: string;
  audio_path: string;
  audio_offset_ms: number;
}

/**
 * MVP ingest scaffold:
 * maps each chapter to a Librivox source URL and canonical chapter identifiers.
 */
export function buildLibrivoxPayload(books: Book[]): LibrivoxChapterAudio[] {
  return books.flatMap((book) =>
    book.chapters.map((chapter) => ({
      book_slug: book.slug,
      chapter_slug: chapter.slug,
      chapter_index: chapter.chapterIndex,
      chapter_title: chapter.title,
      librivox_catalog_url: book.librivoxUrl,
      audio_path: chapter.audioPath,
      audio_offset_ms: chapter.audioOffsetMs,
    })),
  );
}

export const librivoxSeed = buildLibrivoxPayload(seededBooks);
