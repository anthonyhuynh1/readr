import type { ChapterSyncAsset, SyncAssetSentence } from '../types/syncAsset';

const GAP_THRESHOLD_MS = 3000;
/** Matches align_chapter.py default — seek slightly before first spoken word. */
export const INTRO_PRE_ROLL_MS = 250;

/** Detect WhisperX gap: sentence 0 compressed while sentence 1+ retain file-scale times. */
export function hasTimelineGap(asset: ChapterSyncAsset): boolean {
  const s0 = asset.sentences[0];
  const s1 = asset.sentences[1];
  if (!s0?.words.length || !s1?.words.length) return false;

  const s0End = s0.words[s0.words.length - 1].e;
  const s1Start = s1.words[0].s;
  return s1Start - s0End > GAP_THRESHOLD_MS;
}

function shiftSentenceToVisual(sentence: SyncAssetSentence, anchorFileMs: number): void {
  for (const word of sentence.words) {
    word.s = Math.max(0, Math.round(word.s - anchorFileMs));
    word.e = Math.max(word.s + 40, Math.round(word.e - anchorFileMs));
  }
}

/**
 * WhisperX matched sentence 0 to the LibriVox disclaimer while sentence 1+ kept
 * file-audio coords. Re-anchor the timeline so visual 0 = chapter narration start
 * and bump audio_offset_ms so the player skips the intro (see whisperx_offset plan).
 */
export function repairTimelineGap(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  repaired: boolean;
  offsetBumpMs: number;
} {
  if (!hasTimelineGap(asset)) {
    return { asset, repaired: false, offsetBumpMs: 0 };
  }

  const cloned: ChapterSyncAsset = JSON.parse(JSON.stringify(asset)) as ChapterSyncAsset;
  const s0 = cloned.sentences[0];
  const s1 = cloned.sentences[1];
  if (!s0?.words.length || !s1?.words.length) {
    return { asset, repaired: false, offsetBumpMs: 0 };
  }

  const s0Span = s0.words[s0.words.length - 1].e - s0.words[0].s;
  const s1FileStart = s1.words[0].s;
  const anchorFileMs = s1FileStart - s0Span;
  const previousOffset = cloned.audio_offset_ms;
  cloned.audio_offset_ms = Math.max(0, anchorFileMs - INTRO_PRE_ROLL_MS);

  // Sentence 0 already spans 0..s0Span (mis-mapped to intro audio); keep that shape.
  for (let i = 1; i < cloned.sentences.length; i += 1) {
    shiftSentenceToVisual(cloned.sentences[i], anchorFileMs);
  }

  refreshSentenceBounds(cloned.sentences);

  return {
    asset: cloned,
    repaired: true,
    offsetBumpMs: cloned.audio_offset_ms - previousOffset,
  };
}

export function repairMonotonicTimings(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  fixes: number;
} {
  let fixes = 0;
  let prevEnd = 0;

  for (const sentence of asset.sentences) {
    for (const word of sentence.words) {
      if (word.s < prevEnd) {
        word.s = prevEnd;
        fixes += 1;
      }
      if (word.e <= word.s) {
        word.e = word.s + 40;
        fixes += 1;
      }
      prevEnd = word.e;
    }

    if (sentence.words.length > 0) {
      sentence.start_ms = sentence.words[0].s;
      sentence.end_ms = sentence.words[sentence.words.length - 1].e;
    }
  }

  return { asset, fixes };
}

export function repairSyncAsset(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  gapRepaired: boolean;
  monotonicFixes: number;
  offsetBumpMs: number;
} {
  const { asset: gapFixed, repaired: gapRepaired, offsetBumpMs } = repairTimelineGap(asset);
  const { asset: monoFixed, fixes: monotonicFixes } = repairMonotonicTimings(gapFixed);
  return { asset: monoFixed, gapRepaired, monotonicFixes, offsetBumpMs };
}

export function lastWordEndMs(asset: ChapterSyncAsset): number {
  const last = asset.sentences.at(-1)?.words.at(-1);
  return last?.e ?? 0;
}

export function refreshSentenceBounds(sentences: SyncAssetSentence[]): void {
  for (const sentence of sentences) {
    if (sentence.words.length === 0) continue;
    sentence.start_ms = sentence.words[0].s;
    sentence.end_ms = sentence.words[sentence.words.length - 1].e;
  }
}
