import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIBRIVOX_OFFSET_MS,
  mockChapter,
  buildWordIndex,
} from '../data/mockChapter';
import { findActiveWord } from '../utils/syncEngine';

describe('sync engine word resolution', () => {
  it('resolves first word at chapter visual start (after LibriVox offset)', () => {
    const index = buildWordIndex(mockChapter);
    const firstWord = index[0].word;
    const result = findActiveWord(index, firstWord.start_ms);
    expect(result.sentenceIndex).toBe(0);
    expect(result.wordIndex).toBe(0);
    expect(result.word?.start_ms).toBe(DEFAULT_LIBRIVOX_OFFSET_MS);
  });

  it('resolves near end of chapter to last sentence word', () => {
    const index = buildWordIndex(mockChapter);
    const last = index[index.length - 1];
    const result = findActiveWord(index, last.word.end_ms + 100);
    expect(result.sentenceIndex).toBe(last.sentenceIndex);
    expect(result.wordIndex).toBe(last.wordIndex);
  });
});
