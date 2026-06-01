import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { ChapterTextAsset, TextCacheManifest } from '../../types/chapterTextAsset';
import { hashTextAsset } from '../../utils/textAsset';

export { hashTextAsset };

const MANIFEST_PREFIX = 'readr.text.manifest';

function manifestKey(chapterSlug: string): string {
  return `${MANIFEST_PREFIX}.${chapterSlug}`;
}

async function readManifest(chapterSlug: string): Promise<TextCacheManifest | null> {
  const raw = await AsyncStorage.getItem(manifestKey(chapterSlug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TextCacheManifest;
  } catch {
    return null;
  }
}

async function writeManifest(entry: TextCacheManifest): Promise<void> {
  await AsyncStorage.setItem(manifestKey(entry.chapterSlug), JSON.stringify(entry));
}

function localTextPath(chapterSlug: string): string {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  return `${base}text/${chapterSlug}.json`;
}

export interface TextCacheResult {
  asset: ChapterTextAsset;
  fromCache: boolean;
}

/**
 * Load chapter reading text from Storage with hash-based cache invalidation.
 */
export async function loadChapterTextAsset(
  chapterSlug: string,
  remote: {
    textHash: string;
    textVersion: number;
    remoteUrl: string;
  },
): Promise<TextCacheResult> {
  const manifest = await readManifest(chapterSlug);
  const targetPath = localTextPath(chapterSlug);

  if (
    manifest &&
    manifest.textHash === remote.textHash &&
    manifest.textVersion === remote.textVersion
  ) {
    const info = await FileSystem.getInfoAsync(manifest.localPath);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(manifest.localPath);
      return { asset: JSON.parse(raw) as ChapterTextAsset, fromCache: true };
    }
  }

  const dir = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}text/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const download = await FileSystem.downloadAsync(remote.remoteUrl, targetPath);
  const raw = await FileSystem.readAsStringAsync(download.uri);
  const asset = JSON.parse(raw) as ChapterTextAsset;

  await writeManifest({
    chapterSlug,
    textHash: remote.textHash,
    textVersion: remote.textVersion,
    localPath: targetPath,
    updatedAt: new Date().toISOString(),
  });

  return { asset, fromCache: false };
}
