import type { IndexedWord, SyncPosition } from '../types';

/**
 * Binary search: find the last word whose start_ms <= timeMs.
 * Words are sorted by start_ms across the flat index.
 */
export function findActiveWord(
  indexedWords: IndexedWord[],
  timeMs: number,
): SyncPosition {
  if (indexedWords.length === 0) {
    return {
      sentenceIndex: -1,
      wordIndex: -1,
      sentence: null,
      word: null,
    };
  }

  let lo = 0;
  let hi = indexedWords.length - 1;
  let result: IndexedWord | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const entry = indexedWords[mid];

    if (timeMs >= entry.word.start_ms && timeMs < entry.word.end_ms) {
      result = entry;
      break;
    }

    if (timeMs < entry.word.start_ms) {
      hi = mid - 1;
    } else {
      result = entry;
      lo = mid + 1;
    }
  }

  if (!result) {
    const first = indexedWords[0];
    if (timeMs < first.word.start_ms) {
      return {
        sentenceIndex: first.sentenceIndex,
        wordIndex: first.wordIndex,
        sentence: null,
        word: first.word,
      };
    }
    const last = indexedWords[indexedWords.length - 1];
    return {
      sentenceIndex: last.sentenceIndex,
      wordIndex: last.wordIndex,
      sentence: null,
      word: last.word,
    };
  }

  return {
    sentenceIndex: result.sentenceIndex,
    wordIndex: result.wordIndex,
    sentence: null,
    word: result.word,
  };
}
