import type { Chapter, Sentence, WordTimestamp } from '../types';
import type { ChapterTextAsset } from '../types/chapterTextAsset';

/** Deterministic hash for text cache invalidation (mirrors sync asset hashing). */
export function hashTextAsset(asset: ChapterTextAsset): string {
  const payload = JSON.stringify({
    chapter_slug: asset.chapter_slug,
    sentence_count: asset.sentences.length,
    first: asset.sentences[0]?.text.slice(0, 48) ?? '',
    last: asset.sentences.at(-1)?.text.slice(0, 48) ?? '',
  });
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `t${Math.abs(hash).toString(16)}`;
}

function wordsFromText(text: string, startMs: number, msPerWord: number): WordTimestamp[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const words: WordTimestamp[] = [];
  let cursor = startMs;
  let index = 0;

  for (const token of tokens) {
    const duration = msPerWord + (token.length > 6 ? 80 : 0);
    words.push({
      index,
      word: token,
      start_ms: cursor,
      end_ms: cursor + duration,
    });
    cursor += duration;
    index += 1;
  }

  return words;
}

/** Expand Storage text asset into a runtime chapter (synthetic word timings for text-only). */
export function textAssetToChapter(
  asset: ChapterTextAsset,
  meta: {
    bookSlug: string;
    title: string;
    chapterIndex: number;
    pageNumber: number;
    audioPath: string;
    syncMetadataPath: string;
    textMetadataPath: string;
    audioOffsetMs: number;
    textHash: string;
    syncHash?: string;
    syncVersion?: number;
    durationMs?: number;
  },
): Chapter {
  let ms = meta.audioOffsetMs;
  const sentences: Sentence[] = asset.sentences.map((row) => {
    const words = wordsFromText(row.text, ms, 320);
    const lastWord = words.at(-1);
    ms = (lastWord?.end_ms ?? ms) + 400;

    return {
      id: row.id,
      index: row.index,
      text: row.text,
      pageNumber: row.page_number,
      words,
    };
  });

  const lastWord = sentences.at(-1)?.words.at(-1);

  return {
    slug: asset.chapter_slug,
    bookSlug: meta.bookSlug,
    title: meta.title,
    chapterIndex: meta.chapterIndex,
    pageNumber: meta.pageNumber,
    sentences,
    durationMs: meta.durationMs ?? lastWord?.end_ms ?? 0,
    audioPath: meta.audioPath,
    syncMetadataPath: meta.syncMetadataPath,
    audioOffsetMs: meta.audioOffsetMs,
    syncHash: meta.syncHash ?? '',
    syncVersion: meta.syncVersion ?? 1,
    textMetadataPath: meta.textMetadataPath,
    textHash: meta.textHash,
  };
}

export function paragraphsToTextAsset(
  chapterSlug: string,
  pageNumber: number,
  paragraphs: string[],
): ChapterTextAsset {
  return {
    schema_version: 1,
    chapter_slug: chapterSlug,
    sentences: paragraphs.map((text, index) => ({
      id: `${chapterSlug}-s-${index}`,
      index,
      text,
      page_number: pageNumber,
    })),
  };
}
