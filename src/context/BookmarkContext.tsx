/**
 * BookmarkContext — Manages bookmark CRUD with offline-first sync.
 * Loads bookmarks on user change, persists locally, and syncs to Supabase.
 * Does NOT handle bookmark navigation (jumpToBookmark) — that stays in PlaybackContext
 * because it requires cross-domain orchestration (chapter loading + audio seek).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './AuthContext';
import {
  deleteBookmark,
  loadBookmarks,
  syncBookmarkQueue,
  upsertBookmark,
} from '../services/bookmarks/repository';
import type { Bookmark } from '../types';

export interface BookmarkContextValue {
  bookmarks: Bookmark[];
  addBookmark: (
    bookmark: Omit<Bookmark, 'id' | 'created_at' | 'pending_sync'>,
  ) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  /** Reset bookmarks to empty (used on sign-out). */
  clearBookmarks: () => void;
}

const BookmarkContext = createContext<BookmarkContextValue | null>(null);

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Load bookmarks when the authenticated user changes, then flush the sync queue.
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

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  const value = useMemo<BookmarkContextValue>(
    () => ({ bookmarks, addBookmark, removeBookmark, clearBookmarks }),
    [bookmarks, addBookmark, removeBookmark, clearBookmarks],
  );

  return (
    <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>
  );
}

/** Access bookmark state and actions. Must be used within a BookmarkProvider. */
export function useBookmarks(): BookmarkContextValue {
  const ctx = useContext(BookmarkContext);
  if (!ctx)
    throw new Error('useBookmarks must be used within BookmarkProvider');
  return ctx;
}
