import { describe, expect, it } from 'vitest';
import type { ChapterSyncAsset } from '../types/syncAsset';
import { validateSyncAsset } from '../../scripts/alignment/validateSyncAsset';
import type { ChapterAlignInput } from '../../scripts/alignment/extractChapterAlignInput';

const alignInput: ChapterAlignInput = {
  schema_version: 1,
  book_slug: 'the-great-gatsby',
  chapter_slug: 'the-great-gatsby-ch-1',
  chapter_index: 1,
  title: 'Chapter 1',
  sentences: [
    {
      id: 'the-great-gatsby-ch-1-s-0',
      index: 0,
      text: 'In my younger days.',
    },
  ],
};

describe('validateSyncAsset', () => {
  it('accepts a valid visual-timeline asset with pre-roll offset', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'the-great-gatsby-ch-1',
      sync_version: 2,
      audio_offset_ms: 17_750,
      sentences: [
        {
          sentence_id: 'the-great-gatsby-ch-1-s-0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 1200,
          words: [
            { w: 'In', s: 0, e: 200 },
            { w: 'my', s: 200, e: 400 },
            { w: 'younger', s: 400, e: 800 },
            { w: 'days.', s: 800, e: 1200 },
          ],
        },
      ],
    };

    const result = validateSyncAsset(asset, alignInput);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects word count mismatch vs reference', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'the-great-gatsby-ch-1',
      sync_version: 2,
      audio_offset_ms: 1000,
      sentences: [
        {
          sentence_id: 'the-great-gatsby-ch-1-s-0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 200,
          words: [{ w: 'In', s: 0, e: 200 }],
        },
      ],
    };

    const result = validateSyncAsset(asset, alignInput);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('word count mismatch'))).toBe(true);
  });
});
