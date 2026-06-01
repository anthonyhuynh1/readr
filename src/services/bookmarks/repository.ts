import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSupabaseConfig } from '../../config/env';
import { isDevGuestUserId } from '../auth/session';
import { getSupabaseClient } from '../supabase/client';
import type { Bookmark, PendingBookmarkMutation } from '../../types';

const LOCAL_BOOKMARKS_KEY = 'readr.bookmarks.cache';
const LOCAL_QUEUE_KEY = 'readr.bookmarks.queue';

function nowIso(): string {
  return new Date().toISOString();
}

function createBookmarkId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readBookmarkCache(): Promise<Bookmark[]> {
  const raw = await AsyncStorage.getItem(LOCAL_BOOKMARKS_KEY);
  return parseJson<Bookmark[]>(raw, []);
}

async function writeBookmarkCache(bookmarks: Bookmark[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

async function readMutationQueue(): Promise<PendingBookmarkMutation[]> {
  const raw = await AsyncStorage.getItem(LOCAL_QUEUE_KEY);
  return parseJson<PendingBookmarkMutation[]>(raw, []);
}

async function writeMutationQueue(
  queue: PendingBookmarkMutation[],
): Promise<void> {
  await AsyncStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(queue));
}

function enqueueMutation(
  queue: PendingBookmarkMutation[],
  mutation: PendingBookmarkMutation,
) {
  return [...queue, mutation];
}

export async function loadBookmarks(userId: string): Promise<Bookmark[]> {
  const cache = await readBookmarkCache();
  if (isDevGuestUserId(userId)) {
    return cache.filter((entry) => entry.user_id === userId);
  }

  const client = getSupabaseClient();
  if (!client) return cache.filter((entry) => entry.user_id === userId);

  const { data, error } = await client
    .from('user_highlights')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return cache.filter((entry) => entry.user_id === userId);
  }

  const merged = data as Bookmark[];
  await writeBookmarkCache(merged);
  return merged;
}

export async function upsertBookmark(
  bookmarkInput: Omit<Bookmark, 'id' | 'created_at' | 'pending_sync'>,
): Promise<Bookmark> {
  const localOnly = isDevGuestUserId(bookmarkInput.user_id);
  const bookmark: Bookmark = {
    ...bookmarkInput,
    id: hasSupabaseConfig() ? createBookmarkId() : `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: nowIso(),
    pending_sync: !localOnly,
  };

  const current = await readBookmarkCache();
  await writeBookmarkCache([bookmark, ...current]);

  if (!localOnly) {
    const queue = await readMutationQueue();
    await writeMutationQueue(
      enqueueMutation(queue, {
        id: bookmark.id,
        type: 'upsert',
        payload: bookmark,
        created_at: nowIso(),
      }),
    );
  }

  return bookmark;
}

export async function deleteBookmark(
  bookmarkId: string,
  userId: string,
): Promise<void> {
  const current = await readBookmarkCache();
  await writeBookmarkCache(current.filter((entry) => entry.id !== bookmarkId));

  if (isDevGuestUserId(userId)) return;

  const queue = await readMutationQueue();
  await writeMutationQueue(
    enqueueMutation(queue, {
      id: `${bookmarkId}-delete`,
      type: 'delete',
      payload: { id: bookmarkId, user_id: userId },
      created_at: nowIso(),
    }),
  );
}

export async function syncBookmarkQueue(userId: string): Promise<void> {
  if (isDevGuestUserId(userId)) return;

  const client = getSupabaseClient();
  if (!client) return;

  const queue = await readMutationQueue();
  if (queue.length === 0) return;

  const remaining: PendingBookmarkMutation[] = [];

  for (const mutation of queue) {
    if (mutation.type === 'upsert') {
      const payload = mutation.payload as Bookmark;
      const { error } = await client.from('user_highlights').upsert({
        id: payload.id,
        user_id: payload.user_id,
        book_slug: payload.book_slug,
        book_title: payload.book_title,
        chapter_slug: payload.chapter_slug,
        chapter_title: payload.chapter_title,
        sentence_id: payload.sentence_id,
        page_hint: payload.page_hint,
        line_index: payload.line_index,
        text_preview: payload.text_preview,
        timestamp_start_ms: payload.timestamp_start_ms,
      });
      if (error) remaining.push(mutation);
    } else {
      const payload = mutation.payload as { id: string; user_id: string };
      const { error } = await client
        .from('user_highlights')
        .delete()
        .eq('id', payload.id)
        .eq('user_id', payload.user_id);
      if (error) remaining.push(mutation);
    }
  }

  await writeMutationQueue(remaining);
  const synced = await loadBookmarks(userId);
  await writeBookmarkCache(synced.map((entry) => ({ ...entry, pending_sync: false })));
}
