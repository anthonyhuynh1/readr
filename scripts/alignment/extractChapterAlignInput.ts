/**
 * Extract chapter sentence text from mockBook.json for WhisperX alignment input.
 *
 * Run: npm run align:extract
 * Optional: npm run align:extract -- --chapter-slug the-great-gatsby-ch-1
 *           npm run align:extract -- --book the-great-gatsby --chapter 1
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  defaultChapterMediaEntry,
  findChapterMediaBySlug,
  findChapterMediaEntry,
  resolveRepoPath,
  type ChapterMediaEntry,
} from './chapterMediaManifest';

interface MockBookChapterDef {
  slug: string;
  title: string;
  chapterIndex: number;
  pageNumber: number;
  paragraphs: string[];
}

interface MockBookFile {
  schema_version: number;
  slug: string;
  title: string;
  author: string;
  chapters: MockBookChapterDef[];
}

export interface AlignSentenceInput {
  id: string;
  index: number;
  text: string;
}

export interface ChapterAlignInput {
  schema_version: number;
  book_slug: string;
  chapter_slug: string;
  chapter_index: number;
  title: string;
  sentences: AlignSentenceInput[];
}

const MOCK_BOOK_PATH = join(process.cwd(), 'src', 'mocks', 'mockBook.json');

function loadMockBook(): MockBookFile {
  const raw = readFileSync(MOCK_BOOK_PATH, 'utf8');
  const data = JSON.parse(raw) as MockBookFile;
  if (data.schema_version !== 1) {
    throw new Error(`Unsupported mockBook schema_version: ${data.schema_version}`);
  }
  return data;
}

/** Stable sentence IDs — must match chapterBuilder / textAsset / seed. */
export function sentenceIdForChapter(chapterSlug: string, sentenceIndex: number): string {
  return `${chapterSlug}-s-${sentenceIndex}`;
}

export function buildChapterAlignInput(
  mockBook: MockBookFile,
  chapterDef: MockBookChapterDef,
): ChapterAlignInput {
  if (chapterDef.slug.startsWith(`${mockBook.slug}-`) === false) {
    throw new Error(
      `Chapter slug ${chapterDef.slug} is not prefixed with book slug ${mockBook.slug}`,
    );
  }

  const sentences: AlignSentenceInput[] = chapterDef.paragraphs.map((text, index) => ({
    id: sentenceIdForChapter(chapterDef.slug, index),
    index,
    text,
  }));

  return {
    schema_version: 1,
    book_slug: mockBook.slug,
    chapter_slug: chapterDef.slug,
    chapter_index: chapterDef.chapterIndex,
    title: chapterDef.title,
    sentences,
  };
}

function parseArgs(): { entry: ChapterMediaEntry; chapterSlug?: string } {
  const argv = process.argv.slice(2);
  let bookSlug: string | undefined;
  let chapterIndex: number | undefined;
  let chapterSlug: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--chapter-slug' && argv[i + 1]) {
      chapterSlug = argv[++i];
    } else if (arg === '--book' && argv[i + 1]) {
      bookSlug = argv[++i];
    } else if (arg === '--chapter' && argv[i + 1]) {
      chapterIndex = Number.parseInt(argv[++i], 10);
    }
  }

  if (chapterSlug) {
    const entry = findChapterMediaBySlug(chapterSlug);
    if (!entry) {
      throw new Error(
        `No manifest entry for chapter slug "${chapterSlug}". Add it to chapterMediaManifest.ts`,
      );
    }
    return { entry, chapterSlug };
  }

  if (bookSlug !== undefined && chapterIndex !== undefined) {
    const entry = findChapterMediaEntry(bookSlug, chapterIndex);
    if (!entry) {
      throw new Error(
        `No manifest entry for ${bookSlug} ch.${chapterIndex}. Add it to chapterMediaManifest.ts`,
      );
    }
    return { entry };
  }

  return { entry: defaultChapterMediaEntry() };
}

function main(): void {
  const { entry, chapterSlug: slugArg } = parseArgs();
  const mockBook = loadMockBook();

  const chapterDef = mockBook.chapters.find((chapter) => {
    if (slugArg) return chapter.slug === slugArg;
    return chapter.chapterIndex === entry.chapterIndex && mockBook.slug === entry.bookSlug;
  });

  if (!chapterDef) {
    const label = slugArg ?? `${entry.bookSlug} ch.${entry.chapterIndex}`;
    throw new Error(`Chapter not found in mockBook.json: ${label}`);
  }

  const alignInput = buildChapterAlignInput(mockBook, chapterDef);
  const outPath = resolveRepoPath(entry.alignInputPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(alignInput, null, 2)}\n`, 'utf8');

  // eslint-disable-next-line no-console -- CLI script output
  console.log(`Wrote ${entry.alignInputPath}`);
  // eslint-disable-next-line no-console -- CLI script output
  console.log(`  chapter:   ${alignInput.chapter_slug}`);
  // eslint-disable-next-line no-console -- CLI script output
  console.log(`  sentences: ${alignInput.sentences.length}`);
  // eslint-disable-next-line no-console -- CLI script output
  console.log(
    `  first:     ${alignInput.sentences[0]?.text.slice(0, 72)}${(alignInput.sentences[0]?.text.length ?? 0) > 72 ? '…' : ''}`,
  );
}

main();
