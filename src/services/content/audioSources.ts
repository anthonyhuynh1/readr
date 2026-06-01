import { Asset } from 'expo-asset';
import { hasSupabaseConfig } from '../../config/env';
import { resolveChapterAudioStorageUrl } from './supabaseContent';

/** Bundled demo MP3 — offline fallback when Storage is unavailable. */
const demoAudioModule = require('../../../assets/audio/demo-chapter.mp3');

let cachedBundledUri: string | null = null;

async function getBundledAudioUri(): Promise<string> {
  if (cachedBundledUri) return cachedBundledUri;
  const asset = Asset.fromModule(demoAudioModule);
  await asset.downloadAsync();
  cachedBundledUri = asset.localUri ?? asset.uri;
  return cachedBundledUri;
}

export interface ResolvedAudioSource {
  uri: string;
  headers?: Record<string, string>;
}

/** Resolve playable audio URI — Storage when configured, bundled asset as fallback. */
export async function resolveChapterAudioSource(
  chapterSlug: string,
  audioPath?: string,
): Promise<ResolvedAudioSource | null> {
  if (hasSupabaseConfig() && audioPath) {
    return { uri: resolveChapterAudioStorageUrl(audioPath) };
  }

  const bundled = await getBundledAudioUri();
  if (bundled) {
    return { uri: bundled };
  }

  return null;
}

/** @deprecated Use resolveChapterAudioSource */
export function getChapterAudioUrl(_chapterSlug: string): string | null {
  return null;
}
