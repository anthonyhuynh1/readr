import type { WordTimestamp } from '../types';

/** Smooth 0→1 fill progress for a word at the current playback time (UI thread). */
export function getWordFillProgress(
  timeMs: number,
  startMs: number,
  endMs: number,
): number {
  'worklet';
  if (timeMs >= endMs) return 1;
  if (timeMs <= startMs) return 0;
  const duration = endMs - startMs;
  if (duration <= 0) return 1;
  return (timeMs - startMs) / duration;
}

/** Active word within a sentence, including pauses between WhisperX tokens. */
export function findActiveWordIndexInSentence(
  words: WordTimestamp[],
  timeMs: number,
): number {
  if (words.length === 0) return 0;

  let lo = 0;
  let hi = words.length - 1;
  let lastStarted = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const word = words[mid];

    if (timeMs < word.start_ms) {
      hi = mid - 1;
    } else {
      lastStarted = mid;
      lo = mid + 1;
    }
  }

  const candidate = words[lastStarted];
  if (timeMs >= candidate.start_ms && timeMs < candidate.end_ms) {
    return lastStarted;
  }

  if (timeMs >= candidate.end_ms) {
    return lastStarted;
  }

  return lastStarted > 0 ? lastStarted - 1 : 0;
}
