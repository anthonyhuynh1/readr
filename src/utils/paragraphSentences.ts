import type { WordTimestamp } from '../types';

export interface ParagraphSentenceSpan {
  text: string;
  startWordIndex: number;
  endWordIndex: number;
  start_ms: number;
  end_ms: number;
}

const SENTENCE_TERMINATOR = /[.!?]["']?(?=\s|$)/g;

/** Split block text into grammatical sentences (Standard Ebooks-style boundaries). */
export function splitGrammaticalSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences: string[] = [];
  let start = 0;

  for (const match of trimmed.matchAll(SENTENCE_TERMINATOR)) {
    const end = match.index! + match[0].length;
    const slice = trimmed.slice(start, end).trim();
    if (slice) sentences.push(slice);
    start = end;
    while (start < trimmed.length && trimmed[start] === ' ') start += 1;
  }

  const rest = trimmed.slice(start).trim();
  if (rest) sentences.push(rest);

  return sentences.length > 0 ? sentences : [trimmed];
}

function buildFullText(words: WordTimestamp[]): string {
  return words.map((w) => w.word).join(' ');
}

/** Map a character offset in joined word text to a word index. */
export function charOffsetToWordIndex(words: WordTimestamp[], offset: number): number {
  if (words.length === 0) return 0;

  let pos = 0;
  for (let i = 0; i < words.length; i++) {
    const wordEnd = pos + words[i].word.length;
    if (offset < wordEnd) return i;
    pos = wordEnd + (i < words.length - 1 ? 1 : 0);
  }

  return words.length - 1;
}

/** Map grammatical sentences to word timestamp ranges within a sync block. */
export function buildParagraphSentenceSpans(words: WordTimestamp[]): ParagraphSentenceSpan[] {
  if (words.length === 0) return [];

  const fullText = buildFullText(words);
  const sentenceTexts = splitGrammaticalSentences(fullText);
  const spans: ParagraphSentenceSpan[] = [];
  let searchFrom = 0;

  for (const sentenceText of sentenceTexts) {
    const charStart = fullText.indexOf(sentenceText, searchFrom);
    const resolvedStart = charStart >= 0 ? charStart : searchFrom;
    const charEnd = resolvedStart + sentenceText.length;

    const startWordIndex = charOffsetToWordIndex(words, resolvedStart);
    const endWordIndex = charOffsetToWordIndex(
      words,
      Math.max(resolvedStart, charEnd - 1),
    );

    spans.push({
      text: sentenceText,
      startWordIndex,
      endWordIndex,
      start_ms: words[startWordIndex].start_ms,
      end_ms: words[endWordIndex].end_ms,
    });

    searchFrom = charEnd;
  }

  if (spans.length === 0) {
    const last = words.length - 1;
    return [
      {
        text: fullText,
        startWordIndex: 0,
        endWordIndex: last,
        start_ms: words[0].start_ms,
        end_ms: words[last].end_ms,
      },
    ];
  }

  return spans;
}

/** Active grammatical sentence within a block at the current playback time. */
export function findActiveSpanIndex(
  spans: ParagraphSentenceSpan[],
  timeMs: number,
): number {
  if (spans.length === 0) return 0;

  let lastStarted = 0;
  for (let i = 0; i < spans.length; i++) {
    if (timeMs >= spans[i].start_ms) lastStarted = i;
  }

  return lastStarted;
}

/** Words belonging to a single grammatical sentence span. */
export function wordsForSpan(
  words: WordTimestamp[],
  span: ParagraphSentenceSpan,
): WordTimestamp[] {
  return words.slice(span.startWordIndex, span.endWordIndex + 1);
}

export const KARAOKE_WORD_SPAN_FALLBACK_THRESHOLD = 60;
