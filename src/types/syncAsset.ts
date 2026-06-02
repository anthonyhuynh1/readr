/** Minified word entry inside a chapter sync asset. */
export interface SyncAssetWord {
  w: string;
  s: number;
  e: number;
}

/** Minified sentence block inside a chapter sync asset. */
export interface SyncAssetSentence {
  sentence_id: string;
  sentence_index: number;
  start_ms: number;
  end_ms: number;
  words: SyncAssetWord[];
}

/** Canonical on-disk / Storage sync payload (may be gzip-compressed). */
export interface ChapterSyncAsset {
  schema_version: number;
  chapter_slug: string;
  sync_version: number;
  sync_hash?: string;
  audio_offset_ms: number;
  /** Word time coordinate system. Defaults to visual when absent (post-repair assets). */
  timeline_coords?: 'visual' | 'file_absolute';
  sentences: SyncAssetSentence[];
}

/** Local cache manifest entry for invalidation checks. */
export interface SyncCacheManifest {
  chapterSlug: string;
  syncHash: string;
  syncVersion: number;
  localPath: string;
  updatedAt: string;
}
