import { hasSupabaseConfig } from '../../config/env';
import { resolveChapterAudioStorageUrl } from './supabaseContent';

export interface ResolvedAudioSource {
  uri: string;
  headers?: Record<string, string>;
}

/**
 * Resolve playable audio from Supabase Storage. Returns null when no audio path
 * is available (the player falls back to a silent visual clock for reading).
 */
export async function resolveChapterAudioSource(
  _chapterSlug: string,
  audioPath?: string,
): Promise<ResolvedAudioSource | null> {
  if (hasSupabaseConfig() && audioPath) {
    return { uri: resolveChapterAudioStorageUrl(audioPath) };
  }

  return null;
}
