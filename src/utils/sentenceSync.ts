import type { Sentence } from '../types';

export interface SentenceTimeBounds {
  starts: number[];
  ends: number[];
}

export function buildSentenceTimeBounds(sentences: Sentence[]): SentenceTimeBounds {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const sentence of sentences) {
    const first = sentence.words[0];
    const last = sentence.words.at(-1);
    starts.push(first?.start_ms ?? 0);
    ends.push(last?.end_ms ?? first?.end_ms ?? 0);
  }
  return { starts, ends };
}

/** Sentence lookup from playback position (JS thread). */
export function findActiveSentenceIndex(
  starts: number[],
  ends: number[],
  timeMs: number,
): number {
  if (starts.length === 0) return -1;

  let lo = 0;
  let hi = starts.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = starts[mid];
    const boundary =
      mid < starts.length - 1 ? starts[mid + 1] : ends[mid] ?? start;

    if (timeMs >= start && timeMs < boundary) {
      return mid;
    }

    if (timeMs < start) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  if (timeMs >= (ends[ends.length - 1] ?? 0)) {
    return starts.length - 1;
  }

  return 0;
}
