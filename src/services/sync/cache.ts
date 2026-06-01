import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { ChapterSyncAsset, SyncCacheManifest } from '../../types/syncAsset';
import { hashSyncAsset } from '../../utils/syncAsset';

export { hashSyncAsset };

const MANIFEST_KEY = 'readr.sync.manifest';

function manifestKey(chapterSlug: string): string {
  return `${MANIFEST_KEY}.${chapterSlug}`;
}

async function readManifest(chapterSlug: string): Promise<SyncCacheManifest | null> {
  const raw = await AsyncStorage.getItem(manifestKey(chapterSlug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncCacheManifest;
  } catch {
    return null;
  }
}

async function writeManifest(entry: SyncCacheManifest): Promise<void> {
  await AsyncStorage.setItem(manifestKey(entry.chapterSlug), JSON.stringify(entry));
}

function localSyncPath(chapterSlug: string): string {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  return `${base}sync/${chapterSlug}.json`;
}

export interface SyncCacheResult {
  asset: ChapterSyncAsset;
  fromCache: boolean;
}

/**
 * Load chapter sync metadata with hash-based invalidation.
 * Falls back to bundled asset when remote fetch is unavailable.
 */
export async function loadChapterSyncAsset(
  chapterSlug: string,
  remote: {
    syncHash: string;
    syncVersion: number;
    bundledAsset: ChapterSyncAsset;
    remoteUrl?: string;
  },
): Promise<SyncCacheResult> {
  const manifest = await readManifest(chapterSlug);
  const targetPath = localSyncPath(chapterSlug);

  if (
    manifest &&
    manifest.syncHash === remote.syncHash &&
    manifest.syncVersion === remote.syncVersion
  ) {
    const info = await FileSystem.getInfoAsync(manifest.localPath);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(manifest.localPath);
      return { asset: JSON.parse(raw) as ChapterSyncAsset, fromCache: true };
    }
  }

  let asset = remote.bundledAsset;

  if (remote.remoteUrl) {
    try {
      const dir = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}sync/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const download = await FileSystem.downloadAsync(remote.remoteUrl, targetPath);
      const raw = await FileSystem.readAsStringAsync(download.uri);
      asset = JSON.parse(raw) as ChapterSyncAsset;
    } catch {
      asset = remote.bundledAsset;
    }
  } else {
    const dir = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}sync/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    await FileSystem.writeAsStringAsync(targetPath, JSON.stringify(asset));
  }

  await writeManifest({
    chapterSlug,
    syncHash: remote.syncHash,
    syncVersion: remote.syncVersion,
    localPath: targetPath,
    updatedAt: new Date().toISOString(),
  });

  return { asset, fromCache: false };
}

