/**
 * Runtime tuning for aligned chapters (client-side, no re-seed required).
 * Adjust if LibriVox intro length differs from WhisperX-measured offset.
 */
export interface ChapterMediaOverride {
  /** Added to chapters.audio_offset_ms when loading audio. */
  audioOffsetCorrectionMs?: number;
}

export const chapterMediaOverrides: Record<string, ChapterMediaOverride> = {
  // Gatsby ch.1: if the first paragraph drifts, increase this (e.g. 15000) and reload.
  'the-great-gatsby-ch-1': {
    audioOffsetCorrectionMs: 0,
  },
};

export function resolveAudioOffsetMs(
  chapterSlug: string,
  storedOffsetMs: number,
): number {
  const correction = chapterMediaOverrides[chapterSlug]?.audioOffsetCorrectionMs ?? 0;
  return Math.max(0, storedOffsetMs + correction);
}
