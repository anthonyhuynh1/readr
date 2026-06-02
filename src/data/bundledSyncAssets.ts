import type { Chapter } from '../types';
import type { ChapterSyncAsset } from '../types/syncAsset';
import { chapterToSyncAsset } from '../utils/syncAsset';

/** Committed WhisperX output shipped with the app (Metro bundles JSON). */
const bundledBySlug: Record<string, ChapterSyncAsset> = {
  'the-great-gatsby-ch-1':
    require('../../assets/sync/the-great-gatsby/ch-1.json') as ChapterSyncAsset,
};

/** Load aligned sync JSON bundled in the repo, or synthetic timings as fallback. */
export function getBundledSyncAsset(chapter: Chapter): ChapterSyncAsset {
  return bundledBySlug[chapter.slug] ?? chapterToSyncAsset(chapter);
}

/** Slugs with real bundled WhisperX alignment (not synthetic). */
export function hasBundledWhisperXSync(chapterSlug: string): boolean {
  return chapterSlug in bundledBySlug;
}
