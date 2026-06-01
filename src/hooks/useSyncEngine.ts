import { useMemo } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { findActiveWord } from '../utils/syncEngine';
import type { WordTimestamp } from '../types';

/** Resolve sentence object from chapter using sentenceIndex. */
function resolveSentence(
  chapter: ReturnType<typeof usePlayback>['chapter'],
  sentenceIndex: number,
) {
  if (sentenceIndex < 0 || sentenceIndex >= chapter.sentences.length) {
    return null;
  }
  return chapter.sentences[sentenceIndex];
}

export interface SyncEngineResult {
  sentenceIndex: number;
  wordIndex: number;
  sentence: ReturnType<typeof resolveSentence>;
  word: WordTimestamp | null;
  activeSentence: ReturnType<typeof resolveSentence>;
  isWithinWord: boolean;
  wordProgress: number;
  globalWordIndex: number;
}

/**
 * Evaluates which word and sentence are active from the coarse sync clock.
 * Karaoke fill runs on the UI thread via Reanimated SharedValue separately.
 */
export function useSyncEngine(): SyncEngineResult {
  const { chapter, wordIndex, syncTimeMs } = usePlayback();

  return useMemo(() => {
    const position = findActiveWord(wordIndex, syncTimeMs);
    const activeSentence = resolveSentence(chapter, position.sentenceIndex);
    const word: WordTimestamp | null = position.word;

    const isWithinWord =
      word !== null &&
      syncTimeMs >= word.start_ms &&
      syncTimeMs < word.end_ms;

    const wordDuration = word ? word.end_ms - word.start_ms : 0;
    const wordProgress =
      word && wordDuration > 0
        ? Math.min(
            1,
            Math.max(0, (syncTimeMs - word.start_ms) / wordDuration),
          )
        : 0;

    return {
      ...position,
      sentence: activeSentence,
      activeSentence,
      isWithinWord,
      wordProgress,
      globalWordIndex: word?.index ?? -1,
    };
  }, [chapter, wordIndex, syncTimeMs]);
}

export { findActiveWord };
