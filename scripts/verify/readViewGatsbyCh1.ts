/**
 * Offline checks for Read View UX fixes on Gatsby chapter 1 sync data.
 * Run: npx tsx scripts/verify/readViewGatsbyCh1.ts
 */
import bundled from '../../assets/sync/the-great-gatsby/ch-1.json';
import type { ChapterSyncAsset } from '../../src/types/syncAsset';
import { syncAssetToChapter } from '../../src/utils/syncAsset';
import {
  buildParagraphSentenceSpans,
  splitGrammaticalSentences,
} from '../../src/utils/paragraphSentences';
import { estimateRowHeight } from '../../src/utils/readerRowLayout';

const asset = bundled as ChapterSyncAsset;

const chapter = syncAssetToChapter(asset, {
  bookSlug: 'the-great-gatsby',
  title: 'Chapter 1',
  chapterIndex: 1,
  pageNumber: 1,
  audioPath: 'audio/the-great-gatsby/ch-1.mp3',
  syncMetadataPath: 'sync/the-great-gatsby/ch-1.json',
  syncHash: 'verify',
});

const block2 = chapter.sentences[2];
const spans = buildParagraphSentenceSpans(block2.words);
const heights = chapter.sentences.map(estimateRowHeight);

console.log('Gatsby ch.1 Read View verification');
console.log(`Blocks: ${chapter.sentences.length}`);
console.log(`Block 2 words: ${block2.words.length}`);
console.log(`Block 2 grammatical sentences: ${spans.length}`);
console.log(
  `Block 2 span word counts: ${spans.map((s) => s.endWordIndex - s.startWordIndex + 1).join(', ')}`,
);
console.log(
  `Estimated row heights (first 5): ${heights.slice(0, 5).join(', ')}px`,
);
console.log(
  `Block 2 estimated height: ${estimateRowHeight(block2)}px (was ~120px default)`,
);

const sample = block2.text.slice(0, 120);
const split = splitGrammaticalSentences(block2.text);
console.log(`Block 2 preview: ${sample}...`);
console.log(`First span: ${split[0]?.slice(0, 80)}...`);
console.log(`Mid span (index 2): ${spans[2]?.text.slice(0, 80)}...`);

if (spans.length < 2) {
  console.error('FAIL: block 2 should split into multiple grammatical sentences');
  process.exit(1);
}

if (estimateRowHeight(block2) < 400) {
  console.error('FAIL: block 2 height estimate should exceed 400px');
  process.exit(1);
}

console.log('PASS: sentence spans and row height estimates look sane');
