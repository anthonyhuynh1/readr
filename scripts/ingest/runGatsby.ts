/**
 * Ingest The Great Gatsby from Standard Ebooks → src/mocks/mockBook.json
 *
 * Run: npm run ingest:gatsby
 * Offline: npm run ingest:gatsby -- --epub path/to/fitzgerald_the-great-gatsby.epub
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertCleanParagraphs,
  GATSBY_INGEST_CONFIG,
  ingestStandardEbook,
  loadEpubFromFile,
} from './standardEbooks';

function readEpubArg(): string | null {
  const flagIndex = process.argv.indexOf('--epub');
  if (flagIndex === -1) return null;
  return process.argv[flagIndex + 1] ?? null;
}

async function main(): Promise<void> {
  const localEpub = readEpubArg();
  let epubBuffer: ArrayBuffer | undefined;

  if (localEpub) {
    if (!existsSync(localEpub)) {
      throw new Error(`EPUB not found: ${localEpub}`);
    }
    console.log(`Loading local EPUB: ${localEpub}`);
    epubBuffer = await loadEpubFromFile(localEpub);
  } else {
    console.log(`Fetching from GitHub: ${GATSBY_INGEST_CONFIG.githubRepo}`);
  }

  const book = await ingestStandardEbook(GATSBY_INGEST_CONFIG, epubBuffer);
  assertCleanParagraphs(book);

  const outPath = join(process.cwd(), 'src', 'mocks', 'mockBook.json');
  writeFileSync(outPath, `${JSON.stringify(book, null, 2)}\n`, 'utf8');

  const paragraphCount = book.chapters.reduce((n, c) => n + c.paragraphs.length, 0);
  console.log(
    `Wrote ${outPath}\n  ${book.title}: ${book.chapters.length} chapters, ${paragraphCount} paragraphs`,
  );

  for (const chapter of book.chapters) {
    console.log(`  • ${chapter.slug} — ${chapter.paragraphs.length} ¶, ${chapter.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
