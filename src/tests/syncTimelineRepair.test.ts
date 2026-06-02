import { describe, expect, it } from 'vitest';
import type { ChapterSyncAsset } from '../types/syncAsset';
import {
  INTRO_PRE_ROLL_MS,
  hasTimelineGap,
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
    expect(fixed.audio_offset_ms).toBe(anchorFileMs - INTRO_PRE_ROLL_MS);
    expect(offsetBumpMs).toBe(fixed.audio_offset_ms - 341);

    expect(fixed.sentences[0].end_ms).toBe(5104);
    expect(fixed.sentences[1].words[0].s).toBe(5104);
    expect(fixed.sentences[2].words.find((w) => w.w === 'any')?.s).toBe(38232 - anchorFileMs);
  });

  it('maps repaired words to visual time matching audio progress', () => {
    const chapter = syncAssetToChapter(gapAsset(), {
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
    expect(chapter.audioOffsetMs).toBe(27641 - 5104 - INTRO_PRE_ROLL_MS);
  });
});
