/**
 * PlaybackContext — Orchestrates the reading session: chapter loading, audio
 * playback, sync clock, and cross-domain actions (e.g. jumpToBookmark).
 *
 * AI state → AiContext
 * Catalog state → CatalogContext
 * Bookmark CRUD → BookmarkContext
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { EMPTY_BOOK, EMPTY_CHAPTER } from '../data/emptyChapter';
import { buildWordIndex } from '../utils/syncAsset';
import { chapterAudioPlayer } from '../services/audio/chapterPlayer';
import { resolveChapterAudioSource } from '../services/content/audioSources';
import {
  fetchChapter,
  prefetchChapter,
} from '../services/content/repository';
import { usePlaybackProgress } from '../store/ProgressProvider';
import { getContentSources } from '../store/useContentStore';
import {
  usePlaybackStore,
  type PlaybackSpeed,
} from '../store/usePlaybackStore';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';
import { useBookmarks } from './BookmarkContext';
import {
  buildSentenceTimeBounds,
  findActiveSentenceIndex,
  type SentenceTimeBounds,
} from '../utils/sentenceSync';
import type {
  Book,
  Bookmark,
  Chapter,
  IndexedWord,
} from '../types';

const FALLBACK_TICK_MS = 16;
const SKIP_MS = 15_000;

/** Session state and actions for the active reading/playback session. */
export interface PlaybackSessionValue {
  userId: string | null;
  refreshCurrentChapter: () => Promise<void>;
  openBook: (bookSlug: string, chapterSlug?: string) => Promise<void>;
  selectChapter: (chapterSlug: string) => Promise<void>;
  pauseSession: () => Promise<void>;
  stopSessionForSignOut: () => Promise<void>;

  book: Book;
  chapter: Chapter;
  wordIndex: IndexedWord[];
  audioError: string | null;
  audioDurationMs: number;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;

  isPlaying: boolean;
  isImmersive: boolean;

  /** Bookmarks are owned by BookmarkContext; exposed here for cross-domain use. */
  bookmarks: Bookmark[];
  scrollToSentenceIndex: number | null;

  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seekTo: (timeMs: number) => Promise<void>;
  seekToWord: (startMs: number) => Promise<void>;
  skipBack15: () => Promise<void>;
  skipForward15: () => Promise<void>;
  goToPrevChapter: () => Promise<void>;
  goToNextChapter: () => Promise<void>;
  setPlaybackRate: (rate: PlaybackSpeed) => Promise<void>;
  jumpToBookmark: (bookmarkId: string) => Promise<void>;
  clearScrollTarget: () => void;
}

const PlaybackSessionContext = createContext<PlaybackSessionValue | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { progressMs } = usePlaybackProgress();
  const { booksRef } = useCatalog();
  const { bookmarks, clearBookmarks } = useBookmarks();

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const isImmersive = usePlaybackStore((s) => s.isImmersive);
  const scrollToSentenceIndex = usePlaybackStore((s) => s.scrollToSentenceIndex);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const setScrollTarget = usePlaybackStore((s) => s.setScrollTarget);
  const clearScrollTargetStore = usePlaybackStore((s) => s.clearScrollTarget);
  const setChapterSlugs = usePlaybackStore((s) => s.setChapter);
  const setOpeningBook = usePlaybackStore((s) => s.setOpeningBook);
  const setSwitchingChapter = usePlaybackStore((s) => s.setSwitchingChapter);
  const setLoadedBookSlug = usePlaybackStore((s) => s.setLoadedBookSlug);
  const setImmersive = usePlaybackStore((s) => s.setImmersive);
  const storeSetPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);

  const [book, setBook] = useState<Book>(EMPTY_BOOK);
  const [chapter, setChapter] = useState<Chapter>(EMPTY_CHAPTER);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [useFallbackClock, setUseFallbackClock] = useState(false);

  const playbackRateRef = useRef(usePlaybackStore.getState().playbackRate);
  useEffect(() => {
    return usePlaybackStore.subscribe((state) => {
      playbackRateRef.current = state.playbackRate;
    });
  }, []);

  const wordIndex = useMemo(() => buildWordIndex(chapter), [chapter]);

  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chapterSlugRef = useRef(chapter.slug);
  const sentenceBoundsRef = useRef<SentenceTimeBounds>({ starts: [], ends: [] });
  const lastActiveSentenceRef = useRef(-1);

  useEffect(() => {
    chapterSlugRef.current = chapter.slug;
  }, [chapter.slug]);

  useEffect(() => {
    sentenceBoundsRef.current = buildSentenceTimeBounds(chapter.sentences);
    lastActiveSentenceRef.current = -1;
    usePlaybackStore.getState().setActiveSentenceIndex(-1);
  }, [chapter.slug, chapter.sentences]);

  const syncActiveSentenceIndex = useCallback((visualMs: number) => {
    const { starts, ends } = sentenceBoundsRef.current;
    if (starts.length === 0) return;
    const idx = findActiveSentenceIndex(starts, ends, visualMs);
    if (idx !== lastActiveSentenceRef.current) {
      lastActiveSentenceRef.current = idx;
      usePlaybackStore.getState().setActiveSentenceIndex(idx);
    }
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  const chapterIndex = useMemo(
    () => book.chapters.findIndex((c) => c.slug === chapter.slug),
    [book.chapters, chapter.slug],
  );
  const hasPrevChapter = chapterIndex > 0;
  const hasNextChapter = chapterIndex >= 0 && chapterIndex < book.chapters.length - 1;
  const lastWordEndMs = wordIndex.at(-1)?.word.end_ms ?? 0;
  const timelineDurationMs = Math.max(chapter.durationMs, audioDurationMs, lastWordEndMs);

  const applyVisualPosition = useCallback(
    (visualMs: number) => {
      const clamped = Math.max(0, Math.min(visualMs, timelineDurationMs));
      progressMs.value = clamped;
      syncActiveSentenceIndex(clamped);
    },
    [timelineDurationMs, progressMs, syncActiveSentenceIndex],
  );

  const loadChapterAudio = useCallback(
    async (nextChapter: Chapter) => {
      const source = await resolveChapterAudioSource(
        nextChapter.slug,
        nextChapter.audioPath,
      );
      if (!source) {
        setUseFallbackClock(true);
        setAudioError('No audio available for this chapter.');
        return;
      }

      try {
        setAudioError(null);
        await chapterAudioPlayer.load({
          uri: source.uri,
          headers: source.headers,
          audioOffsetMs: nextChapter.audioOffsetMs,
          onVisualPosition: (visualMs) => {
            // Guard against stale callbacks from a previously loaded chapter.
            if (chapterSlugRef.current !== nextChapter.slug) return;
            applyVisualPosition(visualMs);
          },
          onDuration: (durationMs) => {
            if (chapterSlugRef.current !== nextChapter.slug) return;
            setAudioDurationMs(durationMs);
          },
          onEnded: () => {
            setPlaying(false);
          },
          onError: (message) => {
            setAudioError(message);
            setUseFallbackClock(true);
          },
        });
        await chapterAudioPlayer.setRate(playbackRateRef.current);
        setUseFallbackClock(false);
        // If the user pressed play while audio was still loading, start playback now.
        // Without this, play() sees isLoaded()=false, sets isPlaying=true but never
        // starts the player, leaving the progress bar and karaoke stalled.
        if (usePlaybackStore.getState().isPlaying) {
          await chapterAudioPlayer.play();
        }
      } catch (error) {
        setUseFallbackClock(true);
        setAudioError(
          error instanceof Error ? error.message : 'Could not load chapter audio.',
        );
      }
    },
    [applyVisualPosition, setPlaying],
  );

  const applyChapter = useCallback(
    async (nextBook: Book, nextChapter: Chapter, resetProgress = true) => {
      await chapterAudioPlayer.unload();
      clearFallbackTimer();
      setPlaying(false);

      setBook(nextBook);
      setChapter(nextChapter);
      setChapterSlugs(nextBook.slug, nextChapter.slug);

      if (resetProgress) {
        progressMs.value = 0;
        setAudioDurationMs(0);
      }

      const { audioEnabled } = getContentSources();
      if (audioEnabled) {
        await loadChapterAudio(nextChapter);
      } else {
        setAudioError(null);
        setUseFallbackClock(true);
      }

      // Prefetch adjacent chapters so switching feels instant.
      const chapterList = nextBook.chapters;
      const idx = chapterList.findIndex((c) => c.slug === nextChapter.slug);
      if (idx > 0) prefetchChapter(nextBook.slug, chapterList[idx - 1].slug);
      if (idx >= 0 && idx < chapterList.length - 1) {
        prefetchChapter(nextBook.slug, chapterList[idx + 1].slug);
      }
    },
    [clearFallbackTimer, loadChapterAudio, progressMs, setChapterSlugs, setPlaying],
  );

  const openBook = useCallback(
    async (bookSlug: string, chapterSlug?: string) => {
      setOpeningBook(true);
      setLoadedBookSlug(null);
      try {
        const catalogBooks = booksRef.current;
        const bookEntry = catalogBooks.find((entry) => entry.slug === bookSlug);
        const resolvedChapterSlug = chapterSlug ?? bookEntry?.chapters[0]?.slug;
        if (!resolvedChapterSlug) {
          throw new Error(`No chapters available for ${bookSlug}`);
        }
        const payload = await fetchChapter(bookSlug, resolvedChapterSlug);
        await applyChapter(payload.book, payload.chapter);
        setLoadedBookSlug(bookSlug);
      } finally {
        setOpeningBook(false);
      }
    },
    [applyChapter, booksRef, setLoadedBookSlug, setOpeningBook],
  );

  const selectChapter = useCallback(
    async (chapterSlug: string) => {
      if (chapterSlug === chapter.slug) return;
      setSwitchingChapter(true);
      try {
        const payload = await fetchChapter(book.slug, chapterSlug);
        await applyChapter(payload.book, payload.chapter);
      } finally {
        setSwitchingChapter(false);
      }
    },
    [applyChapter, book.slug, chapter.slug, setSwitchingChapter],
  );

  const goToPrevChapter = useCallback(async () => {
    if (!hasPrevChapter) return;
    const prev = book.chapters[chapterIndex - 1];
    if (prev) await selectChapter(prev.slug);
  }, [book.chapters, chapterIndex, hasPrevChapter, selectChapter]);

  const goToNextChapter = useCallback(async () => {
    if (!hasNextChapter) return;
    const next = book.chapters[chapterIndex + 1];
    if (next) await selectChapter(next.slug);
  }, [book.chapters, chapterIndex, hasNextChapter, selectChapter]);

  const pauseSession = useCallback(async () => {
    setPlaying(false);
    clearFallbackTimer();
    if (chapterAudioPlayer.isLoaded()) {
      await chapterAudioPlayer.pause();
    }
  }, [clearFallbackTimer, setPlaying]);

  const stopSessionForSignOut = useCallback(async () => {
    setPlaying(false);
    clearFallbackTimer();
    setAudioError(null);
    setAudioDurationMs(0);
    setUseFallbackClock(false);
    // Reset bookmark list via BookmarkContext.
    clearBookmarks();
    progressMs.value = 0;
    setBook(EMPTY_BOOK);
    setChapter(EMPTY_CHAPTER);
    usePlaybackStore.getState().resetForSignOut();
    await chapterAudioPlayer.unload();
  }, [clearBookmarks, clearFallbackTimer, progressMs, setPlaying]);

  const play = useCallback(async () => {
    if (chapterAudioPlayer.isLoaded() && !useFallbackClock) {
      await chapterAudioPlayer.play();
      setPlaying(true);
      return;
    }
    setPlaying(true);
  }, [setPlaying, useFallbackClock]);

  const pause = useCallback(async () => {
    setPlaying(false);
    clearFallbackTimer();
    if (chapterAudioPlayer.isLoaded()) {
      await chapterAudioPlayer.pause();
    }
  }, [clearFallbackTimer, setPlaying]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) await pause();
    else await play();
  }, [isPlaying, pause, play]);

  const seekTo = useCallback(
    async (timeMs: number) => {
      const clamped = Math.max(0, Math.min(timeMs, timelineDurationMs));
      applyVisualPosition(clamped);
      if (chapterAudioPlayer.isLoaded() && !useFallbackClock) {
        await chapterAudioPlayer.seekVisualMs(clamped);
      }
    },
    [applyVisualPosition, timelineDurationMs, useFallbackClock],
  );

  const skipBack15 = useCallback(async () => {
    if (chapterAudioPlayer.isLoaded() && !useFallbackClock) {
      await chapterAudioPlayer.skipVisualMs(-SKIP_MS);
    } else {
      await seekTo(progressMs.value - SKIP_MS);
    }
  }, [progressMs, seekTo, useFallbackClock]);

  const skipForward15 = useCallback(async () => {
    if (chapterAudioPlayer.isLoaded() && !useFallbackClock) {
      await chapterAudioPlayer.skipVisualMs(SKIP_MS);
    } else {
      await seekTo(progressMs.value + SKIP_MS);
    }
  }, [progressMs, seekTo, useFallbackClock]);

  const setPlaybackRate = useCallback(
    async (rate: PlaybackSpeed) => {
      storeSetPlaybackRate(rate);
      playbackRateRef.current = rate;
      await chapterAudioPlayer.setRate(rate);
    },
    [storeSetPlaybackRate],
  );

  const seekToWord = useCallback(
    async (startMs: number) => {
      setImmersive(true);
      // Subtract 300ms to compensate for MP3 keyframe snap — the decoder rounds
      // to the nearest frame boundary, so seeking slightly early lands on the
      // target word rather than the next span boundary.
      await seekTo(Math.max(0, startMs - 300));
      if (!usePlaybackStore.getState().isPlaying && chapterAudioPlayer.isLoaded()) {
        await play();
      }
    },
    [play, seekTo, setImmersive],
  );

  const refreshCurrentChapter = useCallback(async () => {
    if (!book.slug || !chapter.slug) return;
    setSwitchingChapter(true);
    try {
      const payload = await fetchChapter(book.slug, chapter.slug);
      await applyChapter(payload.book, payload.chapter, false);
    } finally {
      setSwitchingChapter(false);
    }
  }, [applyChapter, book.slug, chapter.slug, setSwitchingChapter]);

  /**
   * jumpToBookmark crosses domains: Bookmarks (data) → Chapter (load) → Audio (seek) → Sync (scroll).
   * It lives here as the orchestration layer that connects them.
   */
  const jumpToBookmark = useCallback(
    async (bookmarkId: string) => {
      const target = bookmarks.find((b) => b.id === bookmarkId);
      if (!target) return;
      if (target.chapter_slug !== chapter.slug) {
        const payload = await fetchChapter(target.book_slug, target.chapter_slug);
        await applyChapter(payload.book, payload.chapter, false);
      }
      await seekTo(target.timestamp_start_ms);
      setScrollTarget(target.line_index);
    },
    [applyChapter, bookmarks, chapter.slug, seekTo, setScrollTarget],
  );

  const clearScrollTarget = useCallback(() => {
    clearScrollTargetStore();
  }, [clearScrollTargetStore]);

  // Fallback JS clock: advances progressMs when audio is unavailable.
  useEffect(() => {
    if (!isPlaying || !useFallbackClock) return;
    fallbackRef.current = setInterval(() => {
      const advance = FALLBACK_TICK_MS * playbackRateRef.current;
      const next = Math.min(progressMs.value + advance, timelineDurationMs);
      progressMs.value = next;
      syncActiveSentenceIndex(next);
      if (next >= timelineDurationMs) {
        setPlaying(false);
      }
    }, FALLBACK_TICK_MS);

    return () => {
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        fallbackRef.current = null;
      }
    };
  }, [isPlaying, useFallbackClock, timelineDurationMs, progressMs, setPlaying, syncActiveSentenceIndex]);

  // Clean up audio and timers when provider unmounts.
  useEffect(() => {
    return () => {
      clearFallbackTimer();
      void chapterAudioPlayer.unload();
    };
  }, [clearFallbackTimer]);

  const sessionValue = useMemo<PlaybackSessionValue>(
    () => ({
      userId: user?.id ?? null,
      refreshCurrentChapter,
      openBook,
      selectChapter,
      pauseSession,
      stopSessionForSignOut,
      book,
      chapter,
      wordIndex,
      audioError,
      audioDurationMs,
      hasPrevChapter,
      hasNextChapter,
      isPlaying,
      isImmersive,
      bookmarks,
      scrollToSentenceIndex,
      play,
      pause,
      togglePlay,
      seekTo,
      seekToWord,
      skipBack15,
      skipForward15,
      goToPrevChapter,
      goToNextChapter,
      setPlaybackRate,
      jumpToBookmark,
      clearScrollTarget,
    }),
    [
      user?.id,
      refreshCurrentChapter,
      openBook,
      selectChapter,
      pauseSession,
      stopSessionForSignOut,
      book,
      chapter,
      wordIndex,
      audioError,
      audioDurationMs,
      hasPrevChapter,
      hasNextChapter,
      isPlaying,
      isImmersive,
      bookmarks,
      scrollToSentenceIndex,
      play,
      pause,
      togglePlay,
      seekTo,
      seekToWord,
      skipBack15,
      skipForward15,
      goToPrevChapter,
      goToNextChapter,
      setPlaybackRate,
      jumpToBookmark,
      clearScrollTarget,
    ],
  );

  return (
    <PlaybackSessionContext.Provider value={sessionValue}>
      {children}
    </PlaybackSessionContext.Provider>
  );
}

/** Access the active playback session. Must be used within a PlaybackProvider. */
export function usePlaybackSession(): PlaybackSessionValue {
  const ctx = useContext(PlaybackSessionContext);
  if (!ctx) {
    throw new Error('usePlaybackSession must be used within a PlaybackProvider');
  }
  return ctx;
}

/** Alias for usePlaybackSession — preferred hook name for screens and components. */
export function usePlayback(): PlaybackSessionValue {
  return usePlaybackSession();
}
