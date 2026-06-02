import { describe, expect, it } from 'vitest';
import type { ChapterSyncAsset } from '../types/syncAsset';
import { checkSyncAssetReady, syncAssetToChapter } from '../utils/syncAsset';
import { repairSyncAsset } from '../utils/syncTimelineRepair';

const meta = {
  bookSlug: 'the-great-gatsby',
  title: 'Chapter 1',
  chapterIndex: 1,
  pageNumber: 1,
  audioPath: 'audio/the-great-gatsby/ch-1.mp3',
  syncMetadataPath: 'sync/the-great-gatsby/ch-1.json',
  syncHash: 'test',
};

describe('checkSyncAssetReady', () => {
  it('rejects assets with intro timeline gap', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'test-ch-1',
      sync_version: 2,
      audio_offset_ms: 341,
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 5104,
          words: [{ w: 'In', s: 0, e: 5104 }],
        },
        {
          sentence_id: 's1',
          sentence_index: 1,
          start_ms: 27641,
          end_ms: 28000,
          words: [{ w: 'Whenever', s: 27641, e: 28000 }],
        },
      ],
    };

    expect(checkSyncAssetReady(asset).ok).toBe(false);
  });

  it('accepts repaired visual-timeline assets', () => {
    const raw: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'test-ch-1',
      sync_version: 2,
      audio_offset_ms: 341,
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 5104,
          words: [{ w: 'In', s: 0, e: 5104 }],
        },
        {
          sentence_id: 's1',
          sentence_index: 1,
          start_ms: 27641,
          end_ms: 28000,
          words: [{ w: 'Whenever', s: 27641, e: 28000 }],
        },
      ],
    };
    const { asset: repaired } = repairSyncAsset(raw);
    expect(checkSyncAssetReady(repaired).ok).toBe(true);

    const chapter = syncAssetToChapter(repaired, meta);
    expect(chapter.syncReady).toBe(true);
    expect(chapter.sentences[1].words[0].start_ms).toBe(5104);
  });

  it('auto-repairs gap assets when building chapter runtime', () => {
    const raw: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'test-ch-1',
      sync_version: 2,
      audio_offset_ms: 341,
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 5104,
          words: [{ w: 'In', s: 0, e: 5104 }],
        },
        {
          sentence_id: 's1',
          sentence_index: 1,
          start_ms: 27641,
          end_ms: 28000,
          words: [{ w: 'Whenever', s: 27641, e: 28000 }],
        },
      ],
    };

    const chapter = syncAssetToChapter(raw, meta);
    expect(chapter.syncReady).toBe(true);
    expect(chapter.sentences[1].words[0].start_ms).toBeLessThan(6000);
  });
});
