import type { Chapter } from '../types';
import { hasSupabaseConfig } from '../config/env';

/** Audio is playable when Supabase is configured and the chapter has an audio path. */
export function chapterHasPlayableAudio(chapter: Chapter): boolean {
  return Boolean(hasSupabaseConfig() && chapter.audioPath);
}

export function chapterHasWordTimings(chapter: Chapter): boolean {
  return chapter.sentences.some((s) => s.words.some((w) => w.end_ms > w.start_ms));
}
