import { describe, expect, it } from 'vitest';
import { findActiveSentenceIndex } from '../utils/sentenceSync';

describe('findActiveSentenceIndex', () => {
  const starts = [0, 5000, 12000];
  const ends = [4800, 11000, 20000];

  it('returns the sentence covering the current time', () => {
    expect(findActiveSentenceIndex(starts, ends, 2500)).toBe(0);
    expect(findActiveSentenceIndex(starts, ends, 7000)).toBe(1);
    expect(findActiveSentenceIndex(starts, ends, 15000)).toBe(2);
  });

  it('keeps the current sentence highlighted during a gap before the next one', () => {
    expect(findActiveSentenceIndex(starts, ends, 11500)).toBe(1);
  });
});
