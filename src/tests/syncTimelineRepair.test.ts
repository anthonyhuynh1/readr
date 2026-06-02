import { describe, expect, it } from 'vitest';
import type { ChapterSyncAsset } from '../types/syncAsset';
import {
  INTRO_PRE_ROLL_MS,
  hasTimelineGap,
  migrateLegacyIntroOffset,
  repairInterSentenceGaps,
  repairSyncAsset,
} from '../utils/syncTimelineRepair';
import { syncAssetToChapter } from '../utils/syncAsset';

const gapAsset = (): ChapterSyncAsset => ({
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
    {
      sentence_id: 's2',
      sentence_index: 2,
      start_ms: 37611,
      end_ms: 38500,
      words: [
        { w: 'He', s: 37611, e: 37700 },
        { w: 'any', s: 38232, e: 38392 },
      ],
    },
  ],
});

describe('syncTimelineRepair', () => {
  it('detects gap between sentence 0 and sentence 1', () => {
    expect(hasTimelineGap(gapAsset())).toBe(true);
  });

  it('re-anchors timeline and sets intro skip offset', () => {
    const { asset: fixed, gapRepaired, offsetBumpMs } = repairSyncAsset(gapAsset());
    expect(gapRepaired).toBe(true);

    const anchorFileMs = 27641 - 5104;
    expect(fixed.audio_offset_ms).toBe(anchorFileMs);
    expect(offsetBumpMs).toBe(fixed.audio_offset_ms - 341);

    expect(fixed.sentences[0].end_ms).toBe(5104);
    expect(fixed.sentences[1].words[0].s).toBe(5104);
    expect(fixed.sentences[2].words.find((w) => w.w === 'any')?.s).toBe(38232 - anchorFileMs);
  });

  it('maps repaired words to visual time matching audio progress', () => {
    const { asset: repaired } = repairSyncAsset(gapAsset());
    const chapter = syncAssetToChapter(repaired, {
      bookSlug: 'gatsby',
      title: 'Ch1',
      chapterIndex: 0,
      pageNumber: 1,
      audioPath: '',
      syncMetadataPath: '',
      syncHash: 'x',
    });

    const anyWord = chapter.sentences[2].words.find((w) => w.word === 'any');
    expect(anyWord?.start_ms).toBe(38232 - (27641 - 5104));
    expect(chapter.audioOffsetMs).toBe(27641 - 5104);
  });

  it('returns the same asset reference when no gap and timings are monotonic', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'ok-ch-1',
      sync_version: 2,
      audio_offset_ms: 1000,
      timeline_coords: 'visual',
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 500,
          words: [{ w: 'Hello', s: 0, e: 500 }],
        },
        {
          sentence_id: 's1',
          sentence_index: 1,
          start_ms: 500,
          end_ms: 1000,
          words: [{ w: 'world', s: 500, e: 1000 }],
        },
      ],
    };

    const { asset: fixed, gapRepaired, monotonicFixes } = repairSyncAsset(asset);
    expect(gapRepaired).toBe(false);
    expect(monotonicFixes).toBe(0);
    expect(fixed.timeline_coords).toBe('visual');
    expect(fixed.sync_version).toBe(3);
    expect(fixed).not.toBe(asset);
  });

  it('closes inter-sentence timeline gaps', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'gap-ch-1',
      sync_version: 3,
      timeline_coords: 'visual',
      audio_offset_ms: 0,
      sentences: [
        {
          sentence_id: 's0',
          sentence_index: 0,
          start_ms: 0,
          end_ms: 1000,
          words: [{ w: 'One', s: 0, e: 1000 }],
        },
        {
          sentence_id: 's1',
          sentence_index: 1,
          start_ms: 3500,
          end_ms: 4500,
          words: [{ w: 'Two', s: 3500, e: 4500 }],
        },
      ],
    };

    const { asset: fixed, gapsClosed, msRemoved } = repairInterSentenceGaps(asset);
    expect(gapsClosed).toBe(1);
    expect(msRemoved).toBe(2500);
    expect(fixed.sentences[1].words[0].s).toBe(1000);
  });

  it('migrates legacy offset that subtracted intro pre-roll from anchor', () => {
    const asset: ChapterSyncAsset = {
      schema_version: 1,
      chapter_slug: 'test-ch-1',
      sync_version: 2,
      timeline_coords: 'visual',
      audio_offset_ms: 22287,
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
          start_ms: 5104,
          end_ms: 5200,
          words: [{ w: 'Whenever', s: 5104, e: 5200 }],
        },
      ],
    };

    const { asset: fixed, migrated, offsetBumpMs } = migrateLegacyIntroOffset(asset);
    expect(migrated).toBe(true);
    expect(offsetBumpMs).toBe(INTRO_PRE_ROLL_MS);
    expect(fixed.audio_offset_ms).toBe(22537);
    expect(fixed.sync_version).toBe(3);
  });
});
