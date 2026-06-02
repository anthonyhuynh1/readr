import { describe, expect, it } from 'vitest';
import { findActiveWordIndexInSentence } from '../utils/karaoke';
import type { WordTimestamp } from '../types';

const words: WordTimestamp[] = [
  { index: 0, word: 'One', start_ms: 0, end_ms: 400 },
  { index: 1, word: 'Two', start_ms: 2000, end_ms: 2400 },
  { index: 2, word: 'Three', start_ms: 5000, end_ms: 5400 },
];

describe('findActiveWordIndexInSentence', () => {
  it('returns the word covering the current time', () => {
    expect(findActiveWordIndexInSentence(words, 100)).toBe(0);
    expect(findActiveWordIndexInSentence(words, 2100)).toBe(1);
  });

  it('holds the previous word during a pause between tokens', () => {
    expect(findActiveWordIndexInSentence(words, 1500)).toBe(0);
    expect(findActiveWordIndexInSentence(words, 3000)).toBe(1);
  });

  it('returns the last started word after the final token ends', () => {
    expect(findActiveWordIndexInSentence(words, 6000)).toBe(2);
  });
});
