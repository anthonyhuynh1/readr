import { describe, expect, it } from 'vitest';
import { mockChapter, buildWordIndex } from '../data/mockChapter';
import { findActiveWord } from '../utils/syncEngine';

describe('sync engine word resolution', () => {
  it('resolves first word at visual timeline zero', () => {
    const index = buildWordIndex(mockChapter);
    const result = findActiveWord(index, 0);
    expect(result.sentenceIndex).toBe(0);
    expect(result.wordIndex).toBe(0);
    expect(result.word?.start_ms).toBe(0);
  });

  it('resolves near end of chapter to last sentence word', () => {
    const index = buildWordIndex(mockChapter);
    const last = index[index.length - 1];
    const result = findActiveWord(index, last.word.end_ms + 100);
    expect(result.sentenceIndex).toBe(last.sentenceIndex);
    expect(result.wordIndex).toBe(last.wordIndex);
  });
});
