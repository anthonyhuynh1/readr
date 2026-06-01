/**
 * Export bundled chapter sync JSON assets from seeded mock data.
 * Run: npx tsx scripts/alignment/exportSyncAssets.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBundledSyncAsset, seededBooks } from '../../src/data/mockChapter';
import { hashSyncAsset } from '../../src/utils/syncAsset';

const OUT_DIR = join(process.cwd(), 'assets', 'sync');

mkdirSync(OUT_DIR, { recursive: true });

for (const book of seededBooks) {
  for (const chapter of book.chapters) {
    const asset = getBundledSyncAsset(chapter);
    asset.sync_hash = hashSyncAsset(asset);

    const bookDir = join(OUT_DIR, book.slug);
    mkdirSync(bookDir, { recursive: true });

    const fileName = `${chapter.slug.replace(`${book.slug}-`, '')}.json`;
    const outPath = join(bookDir, fileName);
    writeFileSync(outPath, JSON.stringify(asset, null, 2));
    // eslint-disable-next-line no-console -- CLI script output
    console.log(`wrote ${outPath}`);
  }
}

// eslint-disable-next-line no-console -- CLI script output
console.log('Done exporting sync assets.');
