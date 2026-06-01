import type { WordTimestamp } from '../types';

/** Smooth 0→1 fill progress for a word at the current playback time. */
export function getWordFillProgress(
  timeMs: number,
  word: WordTimestamp,
): number {
  if (timeMs >= word.end_ms) return 1;
  if (timeMs <= word.start_ms) return 0;
  const duration = word.end_ms - word.start_ms;
  if (duration <= 0) return 1;
  return (timeMs - word.start_ms) / duration;
}
