/**
 * CatalogContext — Manages the book catalog and discovery list.
 * Hydrates content preferences on mount and refreshes from the content repository.
 * Independent of playback, audio, or reading session state.
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
import { reloadCatalog } from '../services/content/repository';
import { useContentStore } from '../store/useContentStore';
import type { Book, BookCatalogItem } from '../types';

/** Shape exposed by CatalogContext to consumers. */
export interface CatalogContextValue {
  books: Book[];
  catalog: BookCatalogItem[];
  isLoadingContent: boolean;
  /** Stable ref to current books array — avoids stale closures in callbacks. */
  booksRef: React.RefObject<Book[]>;
  refreshCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [catalog, setCatalog] = useState<BookCatalogItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  const booksRef = useRef(books);
  booksRef.current = books;

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

  const contentHydrated = useContentStore((s) => s.hydrated);

  // Kick off content-store hydration on mount.
  useEffect(() => {
    void useContentStore.getState().hydrate();
  }, []);

  // Once the content store finishes hydrating, load the catalog.
  useEffect(() => {
    if (!contentHydrated) return;
    void refreshCatalog();
  }, [contentHydrated, refreshCatalog]);

  const value = useMemo<CatalogContextValue>(
    () => ({ books, catalog, isLoadingContent, booksRef, refreshCatalog }),
    [books, catalog, isLoadingContent, refreshCatalog],
  );

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
}

/** Access book catalog state. Must be rendered inside a `<CatalogProvider>`. */
export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return ctx;
}
