import type { ChapterSyncAsset, SyncAssetSentence, SyncAssetWord } from '../types/syncAsset';

const GAP_THRESHOLD_MS = 3000;
/** Close smaller dead zones between already-visual sentences. */
const INTER_SENTENCE_GAP_MS = 400;
/** Matches align_chapter.py default — seek slightly before first spoken word. */
export const INTRO_PRE_ROLL_MS = 250;
/** Sync assets at/above this version store audio_offset_ms at the narration anchor (not anchor − pre-roll). */
export const OFFSET_ANCHOR_SCHEMA = 3;

/** Detect WhisperX gap: sentence 0 compressed while sentence 1+ retain file-scale times. */
export function hasTimelineGap(asset: ChapterSyncAsset): boolean {
  const s0 = asset.sentences[0];
  const s1 = asset.sentences[1];
  if (!s0?.words.length || !s1?.words.length) return false;

  const s0End = s0.words[s0.words.length - 1].e;
  const s1Start = s1.words[0].s;
  return s1Start - s0End > GAP_THRESHOLD_MS;
}

function cloneSentence(sentence: SyncAssetSentence): SyncAssetSentence {
  return {
    ...sentence,
    words: sentence.words.map((w) => ({ ...w })),
  };
}

function cloneAsset(asset: ChapterSyncAsset): ChapterSyncAsset {
  return {
    ...asset,
    sentences: asset.sentences.map(cloneSentence),
  };
}

function shiftSentenceEarlier(
  sentence: SyncAssetSentence,
  deltaMs: number,
): SyncAssetSentence {
  const words: SyncAssetWord[] = sentence.words.map((word) => ({
    ...word,
    s: Math.max(0, Math.round(word.s - deltaMs)),
    e: Math.max(0, Math.round(word.e - deltaMs)),
  }));
  return {
    ...sentence,
    words,
    start_ms: words[0]?.s ?? sentence.start_ms,
    end_ms: words[words.length - 1]?.e ?? sentence.end_ms,
  };
}

/**
 * Collapse dead air between consecutive sentences so visual time tracks audio.
 * WhisperX often leaves multi-second gaps after the first gap repair.
 */
export function repairInterSentenceGaps(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  gapsClosed: number;
  msRemoved: number;
} {
  if (asset.sentences.length < 2) {
    return { asset, gapsClosed: 0, msRemoved: 0 };
  }

  let gapsClosed = 0;
  let msRemoved = 0;
  let needsClone = false;

  for (let i = 0; i < asset.sentences.length - 1; i += 1) {
    const end = asset.sentences[i].words.at(-1)?.e;
    const start = asset.sentences[i + 1].words[0]?.s;
    if (end === undefined || start === undefined) continue;
    if (start - end > INTER_SENTENCE_GAP_MS) {
      needsClone = true;
      break;
    }
  }

  if (!needsClone) {
    return { asset, gapsClosed: 0, msRemoved: 0 };
  }

  const working = cloneAsset(asset);

  for (let i = 0; i < working.sentences.length - 1; i += 1) {
    const end = working.sentences[i].words.at(-1)?.e;
    const start = working.sentences[i + 1].words[0]?.s;
    if (end === undefined || start === undefined) continue;

    const gap = start - end;
    if (gap <= INTER_SENTENCE_GAP_MS) continue;

    for (let j = i + 1; j < working.sentences.length; j += 1) {
      working.sentences[j] = shiftSentenceEarlier(working.sentences[j], gap);
    }
    gapsClosed += 1;
    msRemoved += gap;
  }

  return { asset: working, gapsClosed, msRemoved };
}

function shiftSentenceImmutable(
  sentence: SyncAssetSentence,
  anchorFileMs: number,
): SyncAssetSentence {
  const words: SyncAssetWord[] = sentence.words.map((word) => {
    const s = Math.max(0, Math.round(word.s - anchorFileMs));
    const e = Math.max(s + 40, Math.round(word.e - anchorFileMs));
    return { ...word, s, e };
  });
  return {
    ...sentence,
    words,
    start_ms: words[0]?.s ?? sentence.start_ms,
    end_ms: words[words.length - 1]?.e ?? sentence.end_ms,
  };
}

/**
 * WhisperX matched sentence 0 to the LibriVox disclaimer while sentence 1+ kept
 * file-audio coords. Re-anchor the timeline so visual 0 = chapter narration start
 * and set audio_offset_ms so the player skips the intro.
 */
export function repairTimelineGap(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  repaired: boolean;
  offsetBumpMs: number;
} {
  if (!hasTimelineGap(asset)) {
    return { asset, repaired: false, offsetBumpMs: 0 };
  }

  const s0 = asset.sentences[0];
  const s1 = asset.sentences[1];
  if (!s0?.words.length || !s1?.words.length) {
    return { asset, repaired: false, offsetBumpMs: 0 };
  }

  const s0Span = s0.words[s0.words.length - 1].e - s0.words[0].s;
  const s1FileStart = s1.words[0].s;
  const anchorFileMs = s1FileStart - s0Span;
  const previousOffset = asset.audio_offset_ms;
  /** Visual 0 = first spoken word in file; player seeks slightly earlier for pre-roll. */
  const audio_offset_ms = Math.max(0, anchorFileMs);

  const sentences = asset.sentences.map((sentence, i) =>
    i === 0 ? cloneSentence(sentence) : shiftSentenceImmutable(sentence, anchorFileMs),
  );

  return {
    asset: {
      ...asset,
      audio_offset_ms,
      timeline_coords: 'visual',
      sync_version: Math.max(asset.sync_version, OFFSET_ANCHOR_SCHEMA),
      sentences,
    },
    repaired: true,
    offsetBumpMs: audio_offset_ms - previousOffset,
  };
}

/**
 * v2 gap-repaired assets stored offset = anchor − pre-roll, which skips the first word.
 * Bump to anchor and mark schema v3.
 */
export function migrateLegacyIntroOffset(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  migrated: boolean;
  offsetBumpMs: number;
} {
  if (asset.sync_version >= OFFSET_ANCHOR_SCHEMA) {
    return { asset, migrated: false, offsetBumpMs: 0 };
  }
  if (asset.timeline_coords !== 'visual' || asset.audio_offset_ms <= 5000) {
    return { asset, migrated: false, offsetBumpMs: 0 };
  }

  const first = asset.sentences[0]?.words[0]?.s;
  if (first !== 0) {
    return { asset, migrated: false, offsetBumpMs: 0 };
  }

  const s0 = asset.sentences[0];
  const s1 = asset.sentences[1];
  if (!s0?.words.length || !s1?.words.length) {
    return { asset, migrated: false, offsetBumpMs: 0 };
  }

  const s0End = s0.words[s0.words.length - 1].e;
  const s1Start = s1.words[0].s;
  if (Math.abs(s1Start - s0End) > 50) {
    return { asset, migrated: false, offsetBumpMs: 0 };
  }

  const previousOffset = asset.audio_offset_ms;
  return {
    asset: {
      ...asset,
      audio_offset_ms: previousOffset + INTRO_PRE_ROLL_MS,
      sync_version: OFFSET_ANCHOR_SCHEMA,
    },
    migrated: true,
    offsetBumpMs: INTRO_PRE_ROLL_MS,
  };
}

export function repairMonotonicTimings(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  fixes: number;
} {
  let fixes = 0;
  let prevEnd = 0;
  let needsClone = false;

  for (const sentence of asset.sentences) {
    for (const word of sentence.words) {
      if (word.s < prevEnd || word.e <= word.s) {
        needsClone = true;
        break;
      }
      prevEnd = word.e;
    }
    if (needsClone) break;
  }

  if (!needsClone) {
    return { asset, fixes: 0 };
  }

  const working = cloneAsset(asset);
  prevEnd = 0;

  for (const sentence of working.sentences) {
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

  return { asset: working, fixes };
}

export function repairSyncAsset(asset: ChapterSyncAsset): {
  asset: ChapterSyncAsset;
  gapRepaired: boolean;
  offsetMigrated: boolean;
  interSentenceGapsClosed: number;
  monotonicFixes: number;
  offsetBumpMs: number;
} {
  const { asset: gapFixed, repaired: gapRepaired, offsetBumpMs: gapBump } =
    repairTimelineGap(asset);
  const { asset: offsetFixed, migrated: offsetMigrated, offsetBumpMs: migrateBump } =
    migrateLegacyIntroOffset(gapFixed);
  const { asset: monoFixed, fixes: monotonicFixes } =
    repairMonotonicTimings(offsetFixed);
  const stamped =
    !hasTimelineGap(monoFixed)
      ? {
          ...monoFixed,
          timeline_coords: 'visual' as const,
          sync_version: Math.max(monoFixed.sync_version, OFFSET_ANCHOR_SCHEMA),
        }
      : monoFixed;
  return {
    asset: stamped,
    gapRepaired,
    offsetMigrated,
    interSentenceGapsClosed: 0,
    monotonicFixes,
    offsetBumpMs: gapBump + migrateBump,
  };
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
