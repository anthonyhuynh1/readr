/**
 * Validate src/mocks/mockBook.json shape and slug uniqueness.
 * Run: npm run validate:mock-book
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function fail(message: string): never {
  console.error(`mockBook.json: ${message}`);
  process.exit(1);
}

const path = join(process.cwd(), 'src', 'mocks', 'mockBook.json');
const raw = readFileSync(path, 'utf8');
const data = JSON.parse(raw) as MockBookFile;

if (data.schema_version !== 1) {
  fail(`unsupported schema_version ${data.schema_version}`);
}

if (!data.slug?.trim()) fail('missing slug');
if (!data.title?.trim()) fail('missing title');
if (!data.author?.trim()) fail('missing author');
if (!Array.isArray(data.chapters) || data.chapters.length === 0) {
  fail('chapters must be a non-empty array');
}

const chapterSlugs = new Set<string>();
for (const chapter of data.chapters) {
  if (chapterSlugs.has(chapter.slug)) {
    fail(`duplicate chapter slug: ${chapter.slug}`);
  }
  chapterSlugs.add(chapter.slug);

  if (!chapter.slug.startsWith(`${data.slug}-`)) {
    fail(`chapter slug ${chapter.slug} must be prefixed with book slug ${data.slug}`);
  }

  if (!Array.isArray(chapter.paragraphs) || chapter.paragraphs.length === 0) {
    fail(`chapter ${chapter.slug} needs at least one paragraph`);
  }

  for (const paragraph of chapter.paragraphs) {
    if (!paragraph.trim()) {
      fail(`chapter ${chapter.slug} has an empty paragraph`);
    }
    if (/<[^>]+>/.test(paragraph)) {
      fail(`chapter ${chapter.slug} contains HTML tags: ${paragraph.slice(0, 80)}`);
    }
  }
}

console.log(
  `OK: ${data.title} (${data.chapters.length} chapters, ${data.chapters.reduce((n, c) => n + c.paragraphs.length, 0)} paragraphs)`,
);
