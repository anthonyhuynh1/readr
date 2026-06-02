import { describe, expect, it } from 'vitest';
import type { ChapterSyncAsset } from '../types/syncAsset';
import { syncAssetToChapter, usesLegacyAudioWordTimings } from '../utils/syncAsset';

const meta = {
  bookSlug: 'the-great-gatsby',
  title: 'Chapter 1',
  chapterIndex: 1,
  pageNumber: 1,
  audioPath: 'audio/the-great-gatsby/ch-1.mp3',
  syncMetadataPath: 'sync/the-great-gatsby/ch-1.json',
  syncHash: 'test',
};

describe('syncAsset legacy timing normalization', () => {
  it('detects legacy audio-absolute word times', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'the-great-gatsby-ch-1',
      sync_version: 1,
      audio_offset_ms: 18_000,
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 18_000,
          end_ms: 19_000,
          words: [{ w: 'In', s: 18_000, e: 18_320 }],
        },
      ],
    };

    expect(usesLegacyAudioWordTimings(asset)).toBe(true);
    const chapter = syncAssetToChapter(asset, meta);
    expect(chapter.sentences[0].words[0].start_ms).toBe(0);
  });

  it('keeps visual word times when already zero-based', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'the-great-gatsby-ch-1',
      sync_version: 1,
      audio_offset_ms: 0,
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 320,
          words: [{ w: 'In', s: 0, e: 320 }],
        },
      ],
    };

    expect(usesLegacyAudioWordTimings(asset)).toBe(false);
    const chapter = syncAssetToChapter(asset, meta);
    expect(chapter.sentences[0].words[0].start_ms).toBe(0);
  });

  it('keeps visual word times with non-zero audio_offset_ms (WhisperX pre-roll)', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'the-great-gatsby-ch-1',
      sync_version: 2,
      audio_offset_ms: 17_750,
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 320,
          words: [{ w: 'In', s: 0, e: 320 }],
        },
      ],
    };

    expect(usesLegacyAudioWordTimings(asset)).toBe(false);
    const chapter = syncAssetToChapter(asset, meta);
    expect(chapter.audioOffsetMs).toBe(17_750);
    expect(chapter.sentences[0].words[0].start_ms).toBe(0);
  });
});
