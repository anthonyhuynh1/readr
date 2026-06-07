import type { Chapter } from '../types';
import type { ChapterSyncAsset } from '../types/syncAsset';
import type { ChapterTextAsset } from '../types/chapterTextAsset';
import { chapterToSyncAsset } from '../utils/syncAsset';

/**
 * Committed WhisperX output shipped with the app (Metro bundles JSON).
 * This doubles as the offline fallback for both sync (karaoke) and reading text
 * so the app stays demoable with no network / before Supabase responds.
 */
const bundledBySlug: Record<string, ChapterSyncAsset> = {
  'the-great-gatsby-ch-1':
    require('../../assets/sync/the-great-gatsby/ch-1.json') as ChapterSyncAsset,
};

/** Slug-keyed bundled WhisperX sync asset, or null when not bundled. */
export function getBundledSyncAssetBySlug(
  chapterSlug: string,
): ChapterSyncAsset | null {
  return bundledBySlug[chapterSlug] ?? null;
}

/** Slug-keyed offline reading-text fallback derived from the bundled sync asset. */
export function getBundledTextAssetBySlug(
  chapterSlug: string,
): ChapterTextAsset | null {
  const sync = bundledBySlug[chapterSlug];
  if (!sync) return null;

  return {
    schema_version: 1,
    chapter_slug: sync.chapter_slug,
    sentences: sync.sentences.map((block) => ({
      id: block.sentence_id,
      index: block.sentence_index,
      text: block.words.map((w) => w.w).join(' '),
      page_number: 1,
    })),
  };
}

/** Load aligned sync JSON bundled in the repo, or synthetic timings as fallback. */
export function getBundledSyncAsset(chapter: Chapter): ChapterSyncAsset {
  return bundledBySlug[chapter.slug] ?? chapterToSyncAsset(chapter);
}

/** Slugs with real bundled WhisperX alignment (not synthetic). */
export function hasBundledWhisperXSync(chapterSlug: string): boolean {
  return chapterSlug in bundledBySlug;
}
