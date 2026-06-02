import { describe, expect, it } from 'vitest';
import type { WordTimestamp } from '../types';
import {
  buildParagraphSentenceSpans,
  charOffsetToWordIndex,
  findActiveSpanIndex,
  splitGrammaticalSentences,
} from '../utils/paragraphSentences';

function wordsFromText(parts: string[], startMs = 0): WordTimestamp[] {
  let index = 0;
  let cursor = startMs;
  return parts.map((word) => {
    const entry: WordTimestamp = {
      index: index++,
      word,
      start_ms: cursor,
      end_ms: cursor + 400,
    };
    cursor += 500;
    return entry;
  });
}

describe('splitGrammaticalSentences', () => {
  it('splits on period, question, and exclamation boundaries', () => {
    expect(
      splitGrammaticalSentences('First sentence. Second one? Third!'),
    ).toEqual(['First sentence.', 'Second one?', 'Third!']);
  });

  it('handles quoted closers', () => {
    expect(splitGrammaticalSentences('He said, "Hello." Then left.')).toEqual([
      'He said, "Hello."',
      'Then left.',
    ]);
  });
});

describe('charOffsetToWordIndex', () => {
  it('maps offsets within joined word text', () => {
    const words = wordsFromText(['Hello', 'world.', 'Foo']);
    expect(charOffsetToWordIndex(words, 0)).toBe(0);
    expect(charOffsetToWordIndex(words, 6)).toBe(1);
    expect(charOffsetToWordIndex(words, 13)).toBe(2);
  });
});

describe('buildParagraphSentenceSpans', () => {
  it('maps each grammatical sentence to word timestamps', () => {
    const words = wordsFromText([
      'Whenever',
      'you',
      'feel',
      'like',
      'criticizing',
      'any',
      'one,',
      'he',
      'told',
      'me,',
      'just',
      'remember.',
    ]);

    const spans = buildParagraphSentenceSpans(words);
    expect(spans).toHaveLength(1);
    expect(spans[0].startWordIndex).toBe(0);
    expect(spans[0].endWordIndex).toBe(words.length - 1);
    expect(spans[0].start_ms).toBe(words[0].start_ms);
    expect(spans[0].end_ms).toBe(words[words.length - 1].end_ms);
  });

  it('creates multiple spans for multi-sentence blocks', () => {
    const words = wordsFromText([
      'First',
      'sentence.',
      'Second',
      'sentence.',
    ]);
    const spans = buildParagraphSentenceSpans(words);

    expect(spans).toHaveLength(2);
    expect(spans[0].text).toBe('First sentence.');
    expect(spans[1].text).toBe('Second sentence.');
    expect(spans[0].startWordIndex).toBe(0);
    expect(spans[0].endWordIndex).toBe(1);
    expect(spans[1].startWordIndex).toBe(2);
    expect(spans[1].endWordIndex).toBe(3);
    expect(spans[1].start_ms).toBe(words[2].start_ms);
  });
});

describe('findActiveSpanIndex', () => {
  const spans = [
    { start_ms: 0, end_ms: 1000 },
    { start_ms: 2000, end_ms: 3000 },
    { start_ms: 4000, end_ms: 5000 },
  ] as ReturnType<typeof buildParagraphSentenceSpans>;

  it('returns the span covering the current time', () => {
    expect(findActiveSpanIndex(spans, 500)).toBe(0);
    expect(findActiveSpanIndex(spans, 2500)).toBe(1);
    expect(findActiveSpanIndex(spans, 4500)).toBe(2);
  });

  it('keeps the previous span during a gap', () => {
    expect(findActiveSpanIndex(spans, 1500)).toBe(0);
  });
});
