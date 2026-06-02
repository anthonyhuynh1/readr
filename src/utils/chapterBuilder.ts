import type { Chapter, Sentence, WordTimestamp } from '../types';
import { chapterToSyncAsset, hashSyncAsset } from './syncAsset';

/** LibriVox intro skip when using full chapter recordings (ms). Demo MP3 uses 0. */
export const DEFAULT_LIBRIVOX_OFFSET_MS = 18_000;
export const DEMO_CHAPTER_AUDIO_OFFSET_MS = 0;

function buildSentence(
  sentenceId: string,
  sentenceIndex: number,
  text: string,
  startMs: number,
  msPerWord: number,
  globalWordOffset: number,
  pageNumber: number,
): { sentence: Sentence; nextMs: number; nextGlobalIndex: number } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const words: WordTimestamp[] = [];
  let cursor = startMs;
  let globalIndex = globalWordOffset;

  for (const token of tokens) {
    const duration = msPerWord + (token.length > 6 ? 80 : 0);
    words.push({
      index: globalIndex,
      word: token,
      start_ms: cursor,
      end_ms: cursor + duration,
    });
    cursor += duration;
    globalIndex += 1;
  }

  return {
    sentence: {
      id: sentenceId,
      index: sentenceIndex,
      words,
      text,
      pageNumber,
    },
    nextMs: cursor + 400,
    nextGlobalIndex: globalIndex,
  };
}

export interface BuildChapterInput {
  slug: string;
  bookSlug: string;
  title: string;
  chapterIndex: number;
  pageNumber: number;
  audioPath: string;
  syncMetadataPath: string;
  audioOffsetMs: number;
  paragraphs: string[];
}

export interface DbSentenceRow {
  id: string;
  sentence_index: number;
  text_content: string;
  start_time_ms: number;
  end_time_ms: number;
  page_number: number;
}

/** Build a readable chapter from Supabase sentence rows (text + optional timings). */
export function buildChapterFromDbSentences(
  meta: Omit<BuildChapterInput, 'paragraphs'>,
  rows: DbSentenceRow[],
): Chapter {
  const ordered = [...rows].sort((a, b) => a.sentence_index - b.sentence_index);
  const sentences: Sentence[] = [];
  let globalWordIndex = 0;
  let syntheticMs = meta.audioOffsetMs;
  const hasTimings = ordered.some((row) => row.end_time_ms > row.start_time_ms);

  for (const row of ordered) {
    const tokens = row.text_content.split(/\s+/).filter(Boolean);
    let startMs = row.start_time_ms;
    let msPerWord = 320;

    if (row.end_time_ms > row.start_time_ms && tokens.length > 0) {
      msPerWord = (row.end_time_ms - row.start_time_ms) / tokens.length;
    } else if (!hasTimings) {
      startMs = syntheticMs;
    }

    const result = buildSentence(
      row.id,
      row.sentence_index,
      row.text_content,
      startMs,
      msPerWord,
      globalWordIndex,
      row.page_number,
    );
    sentences.push(result.sentence);
    syntheticMs = result.nextMs;
    globalWordIndex = result.nextGlobalIndex;
  }

  const lastWord = sentences.at(-1)?.words.at(-1);
  const draft: Chapter = {
    slug: meta.slug,
    bookSlug: meta.bookSlug,
    title: meta.title,
    chapterIndex: meta.chapterIndex,
    pageNumber: meta.pageNumber,
    sentences,
    durationMs: lastWord?.end_ms ?? 0,
    audioPath: meta.audioPath,
    syncMetadataPath: meta.syncMetadataPath,
    audioOffsetMs: meta.audioOffsetMs,
    syncHash: '',
    syncVersion: 1,
  };

  const syncHash = hashSyncAsset(chapterToSyncAsset(draft));
  return { ...draft, syncHash };
}

export function buildChapterFromParagraphs(input: BuildChapterInput): Chapter {
  const sentences: Sentence[] = [];
  let ms = 0;
  let globalWordIndex = 0;

  input.paragraphs.forEach((text, i) => {
    const sentenceId = `${input.slug}-s-${i}`;
    const result = buildSentence(
      sentenceId,
      i,
      text,
      ms,
      320,
      globalWordIndex,
      input.pageNumber,
    );
    sentences.push(result.sentence);
    ms = result.nextMs;
    globalWordIndex = result.nextGlobalIndex;
  });

  const lastWord = sentences.at(-1)?.words.at(-1);
  const draft: Chapter = {
    slug: input.slug,
    bookSlug: input.bookSlug,
    title: input.title,
    chapterIndex: input.chapterIndex,
    pageNumber: input.pageNumber,
    sentences,
    durationMs: lastWord?.end_ms ?? 0,
    audioPath: input.audioPath,
    syncMetadataPath: input.syncMetadataPath,
    audioOffsetMs: input.audioOffsetMs,
    syncHash: '',
    syncVersion: 1,
  };

  const syncHash = hashSyncAsset(chapterToSyncAsset(draft));
  return { ...draft, syncHash };
}
