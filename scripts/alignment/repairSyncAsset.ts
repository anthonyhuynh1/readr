/**
 * Repair WhisperX sync JSON: timeline gap + monotonic word times.
 *
 * Run: npm run repair:sync
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { ChapterSyncAsset } from '../../src/types/syncAsset';
import { repairSyncAsset } from '../../src/utils/syncTimelineRepair';
import { defaultChapterMediaEntry, resolveRepoPath } from './chapterMediaManifest';

function main(): void {
  const entry = defaultChapterMediaEntry();
  const syncPath = resolveRepoPath(entry.syncOutputPath);

  if (!existsSync(syncPath)) {
    console.error(`Sync file not found: ${syncPath}`);
    process.exit(1);
  }

  const asset = JSON.parse(readFileSync(syncPath, 'utf8')) as ChapterSyncAsset;
  const { asset: repaired, gapRepaired, monotonicFixes, offsetBumpMs } = repairSyncAsset(asset);

  writeFileSync(syncPath, `${JSON.stringify(repaired, null, 2)}\n`, 'utf8');
  console.log(`Repaired ${syncPath}`);
  console.log(`  gap repair:      ${gapRepaired ? 'yes' : 'no'}`);
  console.log(`  offset bump ms:  ${offsetBumpMs}`);
  console.log(`  timing fixes:    ${monotonicFixes}`);
  console.log(`  audio_offset_ms: ${repaired.audio_offset_ms}`);
  console.log(`  sent0 end:       ${repaired.sentences[0]?.end_ms ?? 0}`);
  console.log(`  sent1 start:     ${repaired.sentences[1]?.words[0]?.s ?? 'n/a'}`);
}

main();
