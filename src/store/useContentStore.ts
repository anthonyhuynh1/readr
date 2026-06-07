import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'readr.content.sources';

interface ContentStore {
  audioEnabled: boolean;
  readableBookSlugs: string[];
  hydrated: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  setReadableBookSlugs: (slugs: string[]) => void;
  hydrate: () => Promise<void>;
}

async function persist(state: Pick<ContentStore, 'audioEnabled'>) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ audioEnabled: state.audioEnabled }),
  );
}

export const useContentStore = create<ContentStore>((set, get) => ({
  audioEnabled: true,
  readableBookSlugs: [],
  hydrated: false,

  setAudioEnabled: (audioEnabled) => {
    set({ audioEnabled });
    void persist({ ...get(), audioEnabled });
  },

  setReadableBookSlugs: (readableBookSlugs) => {
    set({ readableBookSlugs });
  },

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<{ audioEnabled: boolean }>;
        set({
          audioEnabled: parsed.audioEnabled ?? true,
          hydrated: true,
        });
        return;
      } catch {
        // fall through
      }
    }
    set({ hydrated: true });
  },
}));

/** Non-React access for service layer. */
export function getContentSources(): { audioEnabled: boolean } {
  return { audioEnabled: useContentStore.getState().audioEnabled };
}
