import type { Chapter, Sentence, WordTimestamp } from '../types';
import type { ChapterSyncAsset, SyncAssetSentence } from '../types/syncAsset';
import type { IndexedWord } from '../types';
import { sha256Hex } from './sha256';
import { hasTimelineGap, lastWordEndMs, repairSyncAsset } from './syncTimelineRepair';

export interface SyncAssetRuntimeCheck {
  ok: boolean;
  reason?: string;
}

/** Verify committed sync JSON is safe to load without runtime repair. */
export function checkSyncAssetReady(asset: ChapterSyncAsset): SyncAssetRuntimeCheck {
  if (hasTimelineGap(asset)) {
    return {
      ok: false,
      reason: 'Sync timeline gap detected — run npm run repair:sync and re-seed.',
    };
  }
  if (resolveTimelineCoords(asset) === 'file_absolute') {
    return {
      ok: false,
      reason: 'Sync uses legacy file coordinates — run npm run repair:sync and re-seed.',
    };
  }
  return { ok: true };
}

/** Repair gap-broken sync at load time so karaoke works without a manual rebuild. */
export function normalizeSyncAssetForRuntime(asset: ChapterSyncAsset): ChapterSyncAsset {
  if (!hasTimelineGap(asset)) return asset;

  const { asset: repaired } = repairSyncAsset(asset);
  return {
    ...repaired,
    timeline_coords: 'visual',
  };
}

/** Resolve word time coordinate system for a sync asset. */
export function resolveTimelineCoords(
  asset: ChapterSyncAsset,
): 'visual' | 'file_absolute' {
  if (asset.timeline_coords === 'visual' || asset.timeline_coords === 'file_absolute') {
    return asset.timeline_coords;
  }

  const offset = asset.audio_offset_ms;
  if (offset <= 0) return 'visual';
  const first = asset.sentences[0]?.words[0]?.s;
  if (first === undefined) return 'visual';
  return first >= offset * 0.5 ? 'file_absolute' : 'visual';
}

/** @deprecated Use resolveTimelineCoords — kept for tests and legacy assets. */
export function usesLegacyAudioWordTimings(asset: ChapterSyncAsset): boolean {
  return resolveTimelineCoords(asset) === 'file_absolute';
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
  const runtimeAsset = normalizeSyncAssetForRuntime(asset);
  const syncReady = !hasTimelineGap(runtimeAsset);

  const coords = resolveTimelineCoords(runtimeAsset);
  const legacyTimings = coords === 'file_absolute';
  const offset = runtimeAsset.audio_offset_ms;
  let globalWordIndex = 0;
  const sentences: Sentence[] = runtimeAsset.sentences.map((block) => {
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

  const rawDuration = meta.durationMs ?? lastWordEndMs(runtimeAsset);
  const durationMs =
    legacyTimings && rawDuration > offset ? rawDuration - offset : rawDuration;

  return {
    slug: runtimeAsset.chapter_slug,
    bookSlug: meta.bookSlug,
    title: meta.title,
    chapterIndex: meta.chapterIndex,
    pageNumber: meta.pageNumber,
    durationMs,
    sentences,
    audioPath: meta.audioPath,
    syncMetadataPath: meta.syncMetadataPath,
    audioOffsetMs: runtimeAsset.audio_offset_ms,
    syncHash: meta.syncHash,
    syncVersion: runtimeAsset.sync_version,
    syncReady,
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
    timeline_coords: 'visual',
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

function canonicalSyncPayload(asset: ChapterSyncAsset): string {
  return JSON.stringify({
    schema_version: asset.schema_version,
    chapter_slug: asset.chapter_slug,
    sync_version: asset.sync_version,
    audio_offset_ms: asset.audio_offset_ms,
    timeline_coords: asset.timeline_coords ?? resolveTimelineCoords(asset),
    sentences: asset.sentences,
  });
}

/** SHA-256 hash for sync cache invalidation. */
export function hashSyncAsset(asset: ChapterSyncAsset): string {
  return sha256Hex(canonicalSyncPayload(asset));
}
