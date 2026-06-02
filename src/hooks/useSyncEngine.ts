import { useMemo } from 'react';
import { usePlaybackSession } from '../context/PlaybackContext';
import { useCoarseSyncTime } from './useCoarseSyncTime';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { findActiveWord } from '../utils/syncEngine';
import type { WordTimestamp } from '../types';

/** Resolve sentence object from chapter using sentenceIndex. */
function resolveSentence(
  chapter: ReturnType<typeof usePlaybackSession>['chapter'],
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
 * Sentence index comes from UI-thread ActiveSentenceSync (Zustand).
 * Word-level detail uses a coarse transport clock (~4 Hz).
 */
export function useSyncEngine(): SyncEngineResult {
  const { chapter, wordIndex } = usePlaybackSession();
  const activeSentenceIndex = usePlaybackStore((s) => s.activeSentenceIndex);
  const syncTimeMs = useCoarseSyncTime(250);

  return useMemo(() => {
    const position = findActiveWord(wordIndex, syncTimeMs);
    const sentenceIndex =
      activeSentenceIndex >= 0 ? activeSentenceIndex : position.sentenceIndex;
    const activeSentence = resolveSentence(chapter, sentenceIndex);
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
      sentenceIndex,
      wordIndex: position.wordIndex,
      sentence: activeSentence,
      activeSentence,
      word,
      isWithinWord,
      wordProgress,
      globalWordIndex: word?.index ?? -1,
    };
  }, [chapter, wordIndex, syncTimeMs, activeSentenceIndex]);
}

export { findActiveWord };
