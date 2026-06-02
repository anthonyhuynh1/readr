import type { Chapter } from '../types';
import { hasSupabaseConfig } from '../config/env';

/** Gatsby ch.1 demo — Storage after seed, bundled MP3 offline / pre-seed. */
export function chapterHasPlayableAudio(chapter: Chapter): boolean {
  if (chapter.chapterIndex === 1) {
    return true;
  }
  return Boolean(hasSupabaseConfig() && chapter.audioPath);
}

export function chapterHasWordTimings(chapter: Chapter): boolean {
  return chapter.sentences.some((s) => s.words.some((w) => w.end_ms > w.start_ms));
}
