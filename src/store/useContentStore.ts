import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { hasSupabaseConfig } from '../config/env';

export type TextSource = 'mock-json' | 'legacy-seed' | 'supabase';
export type CatalogSource = 'openlibrary' | 'local-seed';

const STORAGE_KEY = 'readr.content.sources';

function defaultTextSource(): TextSource {
  return hasSupabaseConfig() ? 'supabase' : 'mock-json';
}

interface ContentStore {
  textSource: TextSource;
  catalogSource: CatalogSource;
  audioEnabled: boolean;
  readableBookSlugs: string[];
  hydrated: boolean;
  setTextSource: (source: TextSource) => void;
  setCatalogSource: (source: CatalogSource) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setReadableBookSlugs: (slugs: string[]) => void;
  hydrate: () => Promise<void>;
}

async function persist(state: Pick<ContentStore, 'textSource' | 'catalogSource' | 'audioEnabled'>) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      textSource: state.textSource,
      catalogSource: state.catalogSource,
      audioEnabled: state.audioEnabled,
    }),
  );
}

export const useContentStore = create<ContentStore>((set, get) => ({
  textSource: defaultTextSource(),
  catalogSource: 'openlibrary',
  audioEnabled: false,
  readableBookSlugs: [],
  hydrated: false,

  setTextSource: (textSource) => {
    set({ textSource });
    void persist({ ...get(), textSource });
  },

  setCatalogSource: (catalogSource) => {
    set({ catalogSource });
    void persist({ ...get(), catalogSource });
  },

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
        const parsed = JSON.parse(raw) as Partial<{
          textSource: TextSource;
          catalogSource: CatalogSource;
          audioEnabled: boolean;
        }>;
        set({
          textSource: parsed.textSource ?? defaultTextSource(),
          catalogSource: parsed.catalogSource ?? 'openlibrary',
          audioEnabled: parsed.audioEnabled ?? false,
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

/** Non-React access for repository layer. */
export function getContentSources(): {
  textSource: TextSource;
  catalogSource: CatalogSource;
  audioEnabled: boolean;
} {
  const state = useContentStore.getState();
  return {
    textSource: state.textSource,
    catalogSource: state.catalogSource,
    audioEnabled: state.audioEnabled,
  };
}
