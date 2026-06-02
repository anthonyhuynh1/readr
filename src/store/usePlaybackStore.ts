import { create } from 'zustand';

export const PLAYBACK_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number];

/** Coarse playback state — re-renders only on macro events. */
interface PlaybackStore {
  currentChapterSlug: string | null;
  currentBookSlug: string | null;
  loadedBookSlug: string | null;
  isPlaying: boolean;
  isImmersive: boolean;
  isOpeningBook: boolean;
  isSwitchingChapter: boolean;
  activeSentenceIndex: number;
  scrollToSentenceIndex: number | null;
  playbackRate: PlaybackSpeed;

  setChapter: (bookSlug: string, chapterSlug: string) => void;
  setLoadedBookSlug: (slug: string | null) => void;
  setOpeningBook: (opening: boolean) => void;
  setSwitchingChapter: (switching: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setImmersive: (immersive: boolean) => void;
  setActiveSentenceIndex: (index: number) => void;
  setScrollTarget: (index: number | null) => void;
  clearScrollTarget: () => void;
  setPlaybackRate: (rate: PlaybackSpeed) => void;
  resetForSignOut: () => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  currentChapterSlug: null,
  currentBookSlug: null,
  loadedBookSlug: null,
  isPlaying: false,
  isImmersive: false,
  isOpeningBook: false,
  isSwitchingChapter: false,
  activeSentenceIndex: -1,
  scrollToSentenceIndex: null,
  playbackRate: 1,

  setChapter: (bookSlug, chapterSlug) =>
    set({
      currentBookSlug: bookSlug,
      currentChapterSlug: chapterSlug,
      activeSentenceIndex: -1,
      isImmersive: false,
    }),
  setLoadedBookSlug: (slug) => set({ loadedBookSlug: slug }),
  setOpeningBook: (opening) => set({ isOpeningBook: opening }),
  setSwitchingChapter: (switching) => set({ isSwitchingChapter: switching }),
  setPlaying: (playing) =>
    set((state) => ({
      isPlaying: playing,
      isImmersive: playing ? true : state.isImmersive,
    })),
  setImmersive: (immersive) => set({ isImmersive: immersive }),
  setActiveSentenceIndex: (index) => set({ activeSentenceIndex: index }),
  setScrollTarget: (index) => set({ scrollToSentenceIndex: index }),
  clearScrollTarget: () => set({ scrollToSentenceIndex: null }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  resetForSignOut: () =>
    set({
      currentChapterSlug: null,
      currentBookSlug: null,
      loadedBookSlug: null,
      isPlaying: false,
      isImmersive: false,
      isOpeningBook: false,
      isSwitchingChapter: false,
      activeSentenceIndex: -1,
      scrollToSentenceIndex: null,
    }),
}));
