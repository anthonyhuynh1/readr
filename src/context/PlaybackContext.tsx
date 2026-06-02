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
import { buildWordIndex, mockBook, mockChapter } from '../data/mockChapter';
import { chapterAudioPlayer } from '../services/audio/chapterPlayer';
import { askAi } from '../services/ai/askAi';
import {
  deleteBookmark,
  loadBookmarks,
  syncBookmarkQueue,
  upsertBookmark,
} from '../services/bookmarks/repository';
import { resolveChapterAudioSource } from '../services/content/audioSources';
import {
  fetchChapter,
  prefetchChapter,
  reloadCatalog,
} from '../services/content/repository';
import { usePlaybackProgress } from '../store/ProgressProvider';
import { getContentSources, useContentStore } from '../store/useContentStore';
import {
  usePlaybackStore,
  type PlaybackSpeed,
} from '../store/usePlaybackStore';
import { useAuth } from './AuthContext';
import type {
  AskAiResponse,
  Book,
  BookCatalogItem,
  Bookmark,
  Chapter,
  IndexedWord,
  Sentence,
} from '../types';

const SYNC_UI_INTERVAL_MS = 50;
const FALLBACK_TICK_MS = 16;
const SKIP_MS = 15_000;

/** Session + actions — excludes syncTimeMs so Listen UI avoids ~10 Hz re-renders. */
export interface PlaybackSessionValue {
  books: Book[];
  catalog: BookCatalogItem[];
  userId: string | null;
  isLoadingContent: boolean;
  refreshCatalog: () => Promise<void>;
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

  bookmarks: Bookmark[];
  scrollToSentenceIndex: number | null;
  aiSheetVisible: boolean;
  aiContextSentence: Sentence | null;
  aiResponse: AskAiResponse | null;
  isAskingAi: boolean;

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
  addBookmark: (
    bookmark: Omit<Bookmark, 'id' | 'created_at' | 'pending_sync'>,
  ) => Promise<void>;
  jumpToBookmark: (bookmarkId: string) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  clearScrollTarget: () => void;
  openAskAi: (sentence: Sentence) => void;
  closeAskAi: () => void;
  submitAskAi: (userPrompt: string) => Promise<void>;
}

export interface PlaybackContextValue extends PlaybackSessionValue {
  syncTimeMs: number;
}

const PlaybackSessionContext = createContext<PlaybackSessionValue | null>(null);
const SyncTimeContext = createContext(0);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { progressMs } = usePlaybackProgress();

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

  const [books, setBooks] = useState<Book[]>([]);
  const [catalog, setCatalog] = useState<BookCatalogItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [book, setBook] = useState<Book>(mockBook);
  const [chapter, setChapter] = useState<Chapter>(mockChapter);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [useFallbackClock, setUseFallbackClock] = useState(false);

  const booksRef = useRef(books);
  booksRef.current = books;

  const playbackRateRef = useRef(usePlaybackStore.getState().playbackRate);
  useEffect(() => {
    return usePlaybackStore.subscribe((state) => {
      playbackRateRef.current = state.playbackRate;
    });
  }, []);

  const wordIndex = useMemo(() => buildWordIndex(chapter), [chapter]);

  const [syncTimeMs, setSyncTimeMs] = useState(0);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [aiContextSentence, setAiContextSentence] = useState<Sentence | null>(null);
  const [aiResponse, setAiResponse] = useState<AskAiResponse | null>(null);
  const [isAskingAi, setIsAskingAi] = useState(false);

  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncUiRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chapterSlugRef = useRef(chapter.slug);

  useEffect(() => {
    chapterSlugRef.current = chapter.slug;
  }, [chapter.slug]);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
    if (syncUiRef.current) {
      clearInterval(syncUiRef.current);
      syncUiRef.current = null;
    }
  }, []);

  const chapterIndex = useMemo(
    () => book.chapters.findIndex((c) => c.slug === chapter.slug),
    [book.chapters, chapter.slug],
  );
  const hasPrevChapter = chapterIndex > 0;
  const hasNextChapter = chapterIndex >= 0 && chapterIndex < book.chapters.length - 1;
  const timelineDurationMs = Math.max(chapter.durationMs, audioDurationMs);

  const applyVisualPosition = useCallback(
    (visualMs: number) => {
      const clamped = Math.max(0, Math.min(visualMs, timelineDurationMs));
      progressMs.value = clamped;
      setSyncTimeMs(clamped);
    },
    [timelineDurationMs, progressMs],
  );

  const loadChapterAudio = useCallback(
    async (nextChapter: Chapter) => {
      const source = await resolveChapterAudioSource(
        nextChapter.slug,
        nextChapter.audioPath,
        nextChapter.chapterIndex,
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
        setSyncTimeMs(0);
        setAudioDurationMs(0);
      }

      const { audioEnabled } = getContentSources();
      if (audioEnabled) {
        await loadChapterAudio(nextChapter);
      } else {
        setAudioError(null);
        setUseFallbackClock(true);
      }

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
        const resolvedChapterSlug =
          chapterSlug ??
          bookEntry?.chapters[0]?.slug;
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
    [applyChapter, setLoadedBookSlug, setOpeningBook],
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
    setAiSheetVisible(false);
    setAiContextSentence(null);
    setAiResponse(null);
    setIsAskingAi(false);
    setAudioError(null);
    setAudioDurationMs(0);
    setUseFallbackClock(false);
    setBookmarks([]);
    progressMs.value = 0;
    setSyncTimeMs(0);
    setBook(mockBook);
    setChapter(mockChapter);
    usePlaybackStore.getState().resetForSignOut();
    await chapterAudioPlayer.unload();
  }, [clearFallbackTimer, progressMs, setPlaying]);

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
      await seekTo(startMs);
      if (!usePlaybackStore.getState().isPlaying && chapterAudioPlayer.isLoaded()) {
        await play();
      }
    },
    [play, seekTo, setImmersive],
  );

  const refreshCatalog = useCallback(async () => {
    setIsLoadingContent(true);
    try {
      const { catalog, books: nextBooks } = await reloadCatalog();
      setCatalog(catalog);
      setBooks(nextBooks);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

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

  const catalogSource = useContentStore((s) => s.catalogSource);
  const textSource = useContentStore((s) => s.textSource);
  const contentHydrated = useContentStore((s) => s.hydrated);

  useEffect(() => {
    void useContentStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!contentHydrated) return;
    void refreshCatalog();
  }, [contentHydrated, catalogSource, textSource, refreshCatalog]);

  useEffect(() => {
    if (!user) {
      setBookmarks([]);
      return;
    }

    (async () => {
      const loaded = await loadBookmarks(user.id);
      setBookmarks(loaded);
      await syncBookmarkQueue(user.id);
      const refreshed = await loadBookmarks(user.id);
      setBookmarks(refreshed);
    })();
  }, [user]);

  const addBookmark = useCallback(
    async (partial: Omit<Bookmark, 'id' | 'created_at' | 'pending_sync'>) => {
      const bookmark = await upsertBookmark(partial);
      setBookmarks((prev) => [bookmark, ...prev]);
      if (user) {
        await syncBookmarkQueue(user.id);
        const loaded = await loadBookmarks(user.id);
        setBookmarks(loaded);
      }
    },
    [user],
  );

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

  const removeBookmark = useCallback(
    async (bookmarkId: string) => {
      if (!user) return;
      await deleteBookmark(bookmarkId, user.id);
      setBookmarks((prev) => prev.filter((entry) => entry.id !== bookmarkId));
      await syncBookmarkQueue(user.id);
      const loaded = await loadBookmarks(user.id);
      setBookmarks(loaded);
    },
    [user],
  );

  const clearScrollTarget = useCallback(() => {
    clearScrollTargetStore();
  }, [clearScrollTargetStore]);

  const openAskAi = useCallback((sentence: Sentence) => {
    setAiContextSentence(sentence);
    setAiResponse(null);
    setAiSheetVisible(true);
  }, []);

  const closeAskAi = useCallback(() => {
    setAiSheetVisible(false);
    setAiContextSentence(null);
    setAiResponse(null);
  }, []);

  const submitAskAi = useCallback(
    async (userPrompt: string) => {
      if (!aiContextSentence) return;
      setIsAskingAi(true);
      const neighborhood = chapter.sentences
        .filter(
          (entry) =>
            Math.abs(entry.index - aiContextSentence.index) <= 1 &&
            entry.id !== aiContextSentence.id,
        )
        .map((entry) => entry.text);

      const response = await askAi({
        book_slug: book.slug,
        chapter_slug: chapter.slug,
        sentence_id: aiContextSentence.id,
        sentence_text: aiContextSentence.text,
        surrounding_sentences: neighborhood,
        user_prompt: userPrompt,
      });
      setAiResponse(response);
      setIsAskingAi(false);
    },
    [aiContextSentence, book.slug, chapter],
  );

  useEffect(() => {
    if (!isPlaying || !useFallbackClock) {
      return;
    }

    fallbackRef.current = setInterval(() => {
      const next = Math.min(progressMs.value + FALLBACK_TICK_MS, timelineDurationMs);
      progressMs.value = next;
      setSyncTimeMs(next);
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
  }, [isPlaying, useFallbackClock, timelineDurationMs, progressMs, setPlaying]);

  useEffect(() => {
    if (useFallbackClock) return;

    const id = setInterval(() => {
      setSyncTimeMs(progressMs.value);
    }, SYNC_UI_INTERVAL_MS);

    return () => clearInterval(id);
  }, [useFallbackClock, progressMs]);

  useEffect(() => {
    return () => {
      clearFallbackTimer();
      void chapterAudioPlayer.unload();
    };
  }, [clearFallbackTimer]);

  const sessionValue = useMemo<PlaybackSessionValue>(
    () => ({
      books,
      catalog,
      userId: user?.id ?? null,
      isLoadingContent,
      refreshCatalog,
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
      aiSheetVisible,
      aiContextSentence,
      aiResponse,
      isAskingAi,
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
      addBookmark,
      jumpToBookmark,
      removeBookmark,
      clearScrollTarget,
      openAskAi,
      closeAskAi,
      submitAskAi,
    }),
    [
      books,
      catalog,
      user?.id,
      isLoadingContent,
      refreshCatalog,
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
      aiSheetVisible,
      aiContextSentence,
      aiResponse,
      isAskingAi,
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
      addBookmark,
      jumpToBookmark,
      removeBookmark,
      clearScrollTarget,
      openAskAi,
      closeAskAi,
      submitAskAi,
    ],
  );

  return (
    <PlaybackSessionContext.Provider value={sessionValue}>
      <SyncTimeContext.Provider value={syncTimeMs}>{children}</SyncTimeContext.Provider>
    </PlaybackSessionContext.Provider>
  );
}

export function usePlaybackSession(): PlaybackSessionValue {
  const ctx = useContext(PlaybackSessionContext);
  if (!ctx) {
    throw new Error('usePlaybackSession must be used within a PlaybackProvider');
  }
  return ctx;
}

export function usePlayback(): PlaybackContextValue {
  const session = usePlaybackSession();
  const syncTimeMs = useContext(SyncTimeContext);
  return useMemo(
    () => ({
      ...session,
      syncTimeMs,
    }),
    [session, syncTimeMs],
  );
}
