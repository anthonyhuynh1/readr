import { seededBooks } from '../../src/data/mockChapter';

export interface SeededSentenceAlignment {
  chapter_slug: string;
  sentence_id: string;
  line_index: number;
  sentence_start_ms: number;
  sentence_end_ms: number;
}

/**
 * Converts the existing in-app word timestamps into sentence-level
 * alignment artifacts for initial migration/seed runs.
 */
export function buildSeededSentenceAlignments(): SeededSentenceAlignment[] {
  return seededBooks.flatMap((book) =>
    book.chapters.flatMap((chapter) =>
      chapter.sentences.map((sentence) => ({
        chapter_slug: chapter.slug,
        sentence_id: sentence.id,
        line_index: sentence.index,
        sentence_start_ms: sentence.words[0]?.start_ms ?? 0,
        sentence_end_ms:
          sentence.words[sentence.words.length - 1]?.end_ms ??
          sentence.words[0]?.end_ms ??
          0,
      })),
    ),
  );
}

export const seededSentenceAlignments = buildSeededSentenceAlignments();
