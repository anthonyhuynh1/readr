/**
 * Repair WhisperX sync JSON: enforce monotonic word times, refresh sentence bounds.
 *
 * Run: npm run repair:sync
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { ChapterSyncAsset } from '../../src/types/syncAsset';
import { defaultChapterMediaEntry, resolveRepoPath } from './chapterMediaManifest';

export function repairMonotonicTimings(asset: ChapterSyncAsset): { asset: ChapterSyncAsset; fixes: number } {
  let fixes = 0;
  let prevEnd = 0;

  for (const sentence of asset.sentences) {
    for (const word of sentence.words) {
      if (word.s < prevEnd) {
        word.s = prevEnd;
        fixes += 1;
      }
      if (word.e <= word.s) {
        word.e = word.s + 40;
        fixes += 1;
      }
      prevEnd = word.e;
    }

    if (sentence.words.length > 0) {
      sentence.start_ms = sentence.words[0].s;
      sentence.end_ms = sentence.words[sentence.words.length - 1].e;
    }
  }

  return { asset, fixes };
}

function main(): void {
  const entry = defaultChapterMediaEntry();
  const syncPath = resolveRepoPath(entry.syncOutputPath);

  if (!existsSync(syncPath)) {
    console.error(`Sync file not found: ${syncPath}`);
    process.exit(1);
  }

  const asset = JSON.parse(readFileSync(syncPath, 'utf8')) as ChapterSyncAsset;
  const { asset: repaired, fixes } = repairMonotonicTimings(asset);

  writeFileSync(syncPath, `${JSON.stringify(repaired, null, 2)}\n`, 'utf8');
  console.log(`Repaired ${syncPath}`);
  console.log(`  timing fixes: ${fixes}`);
}

main();
