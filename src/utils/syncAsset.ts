import type { Chapter, Sentence, WordTimestamp } from '../types';
import type { ChapterSyncAsset, SyncAssetSentence } from '../types/syncAsset';
import type { IndexedWord } from '../types';
import { repairSyncAsset } from './syncTimelineRepair';

/** Sync JSON may store word times in file-audio coords (legacy) or visual coords (0 = chapter start). */
export function usesLegacyAudioWordTimings(asset: ChapterSyncAsset): boolean {
  const offset = asset.audio_offset_ms;
  if (offset <= 0) return false;
  const first = asset.sentences[0]?.words[0]?.s;
  if (first === undefined) return false;
  return first >= offset * 0.5;
}

/** Expand minified sync asset into runtime chapter sentences. */
export function syncAssetToChapter(
  asset: ChapterSyncAsset,
  meta: {
    bookSlug: string;
    title: string;
    chapterIndex: number;
    pageNumber: number;
    audioPath: string;
    syncMetadataPath: string;
    syncHash: string;
    durationMs?: number;
  },
): Chapter {
  const { asset: repaired } = repairSyncAsset(asset);
  const legacyTimings = usesLegacyAudioWordTimings(repaired);
  const offset = repaired.audio_offset_ms;
  let globalWordIndex = 0;
  const sentences: Sentence[] = repaired.sentences.map((block) => {
    const words: WordTimestamp[] = block.words.map((entry) => {
      const startMs = legacyTimings ? entry.s - offset : entry.s;
      const endMs = legacyTimings ? entry.e - offset : entry.e;
      const word: WordTimestamp = {
        index: globalWordIndex,
        word: entry.w,
        start_ms: startMs,
        end_ms: endMs,
      };
      globalWordIndex += 1;
      return word;
    });

    return {
      id: block.sentence_id,
      index: block.sentence_index,
      text: words.map((w) => w.word).join(' '),
      pageNumber: meta.pageNumber,
      words,
    };
  });

  const lastWord = sentences.at(-1)?.words.at(-1);
  const rawDuration = meta.durationMs ?? lastWord?.end_ms ?? 0;
  const durationMs =
    legacyTimings && rawDuration > offset ? rawDuration - offset : rawDuration;

  return {
    slug: repaired.chapter_slug,
    bookSlug: meta.bookSlug,
    title: meta.title,
    chapterIndex: meta.chapterIndex,
    pageNumber: meta.pageNumber,
    durationMs,
    sentences,
    audioPath: meta.audioPath,
    syncMetadataPath: meta.syncMetadataPath,
    audioOffsetMs: repaired.audio_offset_ms,
    syncHash: meta.syncHash,
    syncVersion: repaired.sync_version,
  };
}

/** Collapse runtime chapter into minified sync asset for pipeline output. */
export function chapterToSyncAsset(chapter: Chapter): ChapterSyncAsset {
  const sentences: SyncAssetSentence[] = chapter.sentences.map((sentence) => ({
    sentence_id: sentence.id,
    sentence_index: sentence.index,
    start_ms: sentence.words[0]?.start_ms ?? 0,
    end_ms: sentence.words.at(-1)?.end_ms ?? 0,
    words: sentence.words.map((w) => ({ w: w.word, s: w.start_ms, e: w.end_ms })),
  }));

  return {
    schema_version: 1,
    chapter_slug: chapter.slug,
    sync_version: chapter.syncVersion,
    audio_offset_ms: chapter.audioOffsetMs,
    sentences,
  };
}

export function buildWordIndex(chapter: Chapter): IndexedWord[] {
  const indexed: IndexedWord[] = [];
  chapter.sentences.forEach((sentence, sentenceIndex) => {
    sentence.words.forEach((word, wordIndex) => {
      indexed.push({
        globalIndex: word.index,
        sentenceIndex,
        wordIndex,
        word,
      });
    });
  });
  return indexed;
}

/** Visual timeline from audio position (LibriVox offset applied). */
export function audioToVisualMs(audioMs: number, audioOffsetMs: number): number {
  return Math.max(0, audioMs - audioOffsetMs);
}

/** Audio seek target from visual/sync timestamp. */
export function visualToAudioMs(visualMs: number, audioOffsetMs: number): number {
  return visualMs + audioOffsetMs;
}

/** Deterministic hash for sync cache invalidation (replace with SHA-256 in pipeline). */
export function hashSyncAsset(asset: ChapterSyncAsset): string {
  const payload = JSON.stringify({
    chapter_slug: asset.chapter_slug,
    sync_version: asset.sync_version,
    sentence_count: asset.sentences.length,
    first_word: asset.sentences[0]?.words[0]?.w ?? '',
    last_end: asset.sentences.at(-1)?.end_ms ?? 0,
  });
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
