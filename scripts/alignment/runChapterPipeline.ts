/**
 * Unified offline chapter alignment pipeline (local steps).
 * GPU WhisperX still runs in Colab — see scripts/alignment/whisperx/COLAB.md
 *
 * Run: npm run align:chapter
 * Optional: npm run align:chapter -- --book the-great-gatsby --chapter 1
 *           npm run align:chapter -- --chapter-slug the-great-gatsby-ch-1
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ChapterSyncAsset } from '../../src/types/syncAsset';
import { hashSyncAsset } from '../../src/utils/syncAsset';
import { repairSyncAsset } from '../../src/utils/syncTimelineRepair';
import {
  defaultChapterMediaEntry,
  findChapterMediaBySlug,
  findChapterMediaEntry,
  resolveRepoPath,
  type ChapterMediaEntry,
} from './chapterMediaManifest';
import { buildChapterAlignInput, type ChapterAlignInput } from './extractChapterAlignInput';
import { validateSyncAsset } from './validateSyncAsset';

const MOCK_BOOK_PATH = resolveRepoPath('src/mocks/mockBook.json');

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

function loadMockBook(): MockBookFile {
  return JSON.parse(readFileSync(MOCK_BOOK_PATH, 'utf8')) as MockBookFile;
}

function parseArgs(): ChapterMediaEntry {
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
      throw new Error(`No manifest entry for chapter slug "${chapterSlug}"`);
    }
    return entry;
  }

  if (bookSlug !== undefined && chapterIndex !== undefined) {
    const entry = findChapterMediaEntry(bookSlug, chapterIndex);
    if (!entry) {
      throw new Error(`No manifest entry for ${bookSlug} ch.${chapterIndex}`);
    }
    return entry;
  }

  return defaultChapterMediaEntry();
}

function resolveChapterDef(mockBook: MockBookFile, entry: ChapterMediaEntry): MockBookChapterDef {
  const chapterDef = mockBook.chapters.find(
    (chapter) =>
      chapter.chapterIndex === entry.chapterIndex && mockBook.slug === entry.bookSlug,
  );
  if (!chapterDef) {
    throw new Error(`Chapter not found in mockBook.json: ${entry.bookSlug} ch.${entry.chapterIndex}`);
  }
  return chapterDef;
}

function stepExtract(entry: ChapterMediaEntry, mockBook: MockBookFile): ChapterAlignInput {
  const chapterDef = resolveChapterDef(mockBook, entry);
  const alignInput = buildChapterAlignInput(mockBook, chapterDef);
  const outPath = resolveRepoPath(entry.alignInputPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(alignInput, null, 2)}\n`, 'utf8');
  console.log(`[1/4] Wrote align input → ${entry.alignInputPath} (${alignInput.sentences.length} sentences)`);
  return alignInput;
}

function stepCheckAudio(entry: ChapterMediaEntry): void {
  const audioPath = resolveRepoPath(entry.audioLocalPath);
  if (!existsSync(audioPath)) {
    console.error(`[2/4] Missing audio: ${entry.audioLocalPath}`);
    console.error('      Run: npm run fetch:gatsby-audio');
    process.exit(1);
  }
  console.log(`[2/4] Audio OK → ${entry.audioLocalPath}`);
}

function stepColabOrRepair(
  entry: ChapterMediaEntry,
  alignInput: ChapterAlignInput,
): void {
  const syncPath = resolveRepoPath(entry.syncOutputPath);
  if (!existsSync(syncPath)) {
    console.log('[3/4] Sync JSON not found — GPU alignment required');
    console.log('      See scripts/alignment/whisperx/COLAB.md');
    console.log(`      Upload audio + ${entry.alignInputPath} + align_chapter.py`);
    console.log(`      Output target: ${entry.syncOutputPath}`);
    console.log('[4/4] Skipped validate/repair until sync JSON exists');
    return;
  }

  const asset = JSON.parse(readFileSync(syncPath, 'utf8')) as ChapterSyncAsset;
  const { asset: repaired, gapRepaired, monotonicFixes, offsetBumpMs } = repairSyncAsset(asset);
  repaired.sync_hash = hashSyncAsset(repaired);
  if (!repaired.timeline_coords) {
    repaired.timeline_coords = 'visual';
  }

  writeFileSync(syncPath, `${JSON.stringify(repaired, null, 2)}\n`, 'utf8');
  console.log(`[3/4] Repaired sync → ${entry.syncOutputPath}`);
  console.log(`      gap repair: ${gapRepaired ? 'yes' : 'no'} | timing fixes: ${monotonicFixes} | offset bump: ${offsetBumpMs}ms`);
  console.log(`      sync_hash: ${repaired.sync_hash.slice(0, 16)}…`);

  const result = validateSyncAsset(repaired, alignInput);
  for (const warning of result.warnings) {
    console.warn(`warn: ${warning}`);
  }
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`error: ${error}`);
    }
    process.exit(1);
  }

  const wordCount = repaired.sentences.reduce((n, s) => n + s.words.length, 0);
  console.log(`[4/4] Validated OK — ${repaired.sentences.length} sentences, ${wordCount} words`);
}

function main(): void {
  const entry = parseArgs();
  const mockBook = loadMockBook();
  console.log(`Chapter pipeline: ${entry.bookSlug} ch.${entry.chapterIndex}`);
  const alignInput = stepExtract(entry, mockBook);
  stepCheckAudio(entry);
  stepColabOrRepair(entry, alignInput);
}

main();
