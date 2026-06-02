/**
 * Validate ChapterSyncAsset JSON against schema and reference align input.
 *
 * Run: npm run validate:sync
 * Optional: npm run validate:sync -- --sync path/to/ch-1.json --align path/to/sentences.json
 */
import { readFileSync, existsSync } from 'node:fs';
import type { ChapterSyncAsset } from '../../src/types/syncAsset';
import {
  chapterMediaManifest,
  defaultChapterMediaEntry,
  resolveRepoPath,
} from './chapterMediaManifest';
import type { ChapterAlignInput } from './extractChapterAlignInput';

export interface SyncValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const TIME_EPSILON_MS = 5;

function normalizeForCompare(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function validateSyncAsset(
  asset: ChapterSyncAsset,
  alignInput?: ChapterAlignInput,
): SyncValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (asset.schema_version !== 1) {
    errors.push(`unsupported schema_version ${asset.schema_version}`);
  }
  if (asset.sync_version < 1) {
    errors.push(`sync_version must be >= 1 (got ${asset.sync_version})`);
  }
  if (!asset.chapter_slug?.trim()) {
    errors.push('missing chapter_slug');
  }
  if (!Array.isArray(asset.sentences) || asset.sentences.length === 0) {
    errors.push('sentences must be a non-empty array');
  }
  if (asset.audio_offset_ms < 0) {
    errors.push('audio_offset_ms must be >= 0');
  }

  const firstWord = asset.sentences[0]?.words[0];
  if (firstWord && Math.abs(firstWord.s) > TIME_EPSILON_MS) {
    errors.push(`first word visual start must be ~0 (got ${firstWord.s})`);
  }

  if (asset.audio_offset_ms > 0 && firstWord && asset.audio_offset_ms > firstWord.s + 500) {
    // Pre-roll: offset is seek point, typically before first spoken word in file
    warnings.push(
      `audio_offset_ms (${asset.audio_offset_ms}) is larger than first word start — expected pre-roll seek`,
    );
  }

  let prevEnd = -1;
  for (const sentence of asset.sentences) {
    if (!sentence.sentence_id) {
      errors.push('sentence missing sentence_id');
    }
    if (!sentence.words.length) {
      errors.push(`sentence ${sentence.sentence_id} has no words`);
      continue;
    }

    for (const word of sentence.words) {
      if (!word.w?.trim()) {
        errors.push(`empty word in sentence ${sentence.sentence_id}`);
      }
      if (word.e < word.s) {
        errors.push(`word "${word.w}" has end < start (${word.e} < ${word.s})`);
      }
      if (word.s < prevEnd - TIME_EPSILON_MS) {
        errors.push(`non-monotonic timing at word "${word.w}" (${word.s} < ${prevEnd})`);
      }
      prevEnd = word.e;
    }

    const blockStart = sentence.words[0].s;
    const blockEnd = sentence.words[sentence.words.length - 1].e;
    if (Math.abs(sentence.start_ms - blockStart) > TIME_EPSILON_MS) {
      errors.push(`sentence ${sentence.sentence_id} start_ms != first word s`);
    }
    if (Math.abs(sentence.end_ms - blockEnd) > TIME_EPSILON_MS) {
      errors.push(`sentence ${sentence.sentence_id} end_ms != last word e`);
    }
  }

  if (alignInput) {
    if (asset.chapter_slug !== alignInput.chapter_slug) {
      errors.push(
        `chapter_slug mismatch: sync=${asset.chapter_slug} align=${alignInput.chapter_slug}`,
      );
    }
    if (asset.sentences.length !== alignInput.sentences.length) {
      errors.push(
        `sentence count mismatch: sync=${asset.sentences.length} align=${alignInput.sentences.length}`,
      );
    }

    for (let i = 0; i < Math.min(asset.sentences.length, alignInput.sentences.length); i += 1) {
      const block = asset.sentences[i];
      const ref = alignInput.sentences[i];

      if (block.sentence_id !== ref.id) {
        errors.push(`sentence id mismatch at index ${i}: ${block.sentence_id} vs ${ref.id}`);
      }

      const refTokens = tokenize(ref.text);
      const syncTokens = block.words.map((w) => w.w);
      const refNorm = normalizeForCompare(ref.text);
      const syncNorm = normalizeForCompare(syncTokens.join(' '));
      if (refNorm !== syncNorm) {
        if (refTokens.length !== syncTokens.length) {
          errors.push(
            `word count mismatch in ${ref.id}: sync=${syncTokens.length} ref=${refTokens.length}`,
          );
        } else {
          for (let w = 0; w < refTokens.length; w += 1) {
            if (refTokens[w] !== syncTokens[w]) {
              errors.push(
                `word text mismatch in ${ref.id} at ${w}: sync="${syncTokens[w]}" ref="${refTokens[w]}"`,
              );
              break;
            }
          }
        }
      } else if (refTokens.length !== syncTokens.length) {
        warnings.push(
          `token count differs in ${ref.id} (${syncTokens.length} vs ${refTokens.length}) but normalized text matches`,
        );
      }

      if (i === 0 && ref.text.length > 0) {
        const refNorm = normalizeForCompare(ref.text).slice(0, 24);
        const syncNorm = normalizeForCompare(block.words.map((w) => w.w).join(' ')).slice(0, 24);
        if (!syncNorm.startsWith(refNorm.slice(0, 12)) && !refNorm.startsWith(syncNorm.slice(0, 12))) {
          warnings.push('first sentence prefix differs from reference after normalization');
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function parseArgs(): { syncPath: string; alignPath: string | null } {
  const argv = process.argv.slice(2);
  let syncPath: string | undefined;
  let alignPath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sync' && argv[i + 1]) {
      syncPath = argv[++i];
    } else if (argv[i] === '--align' && argv[i + 1]) {
      alignPath = argv[++i];
    }
  }

  if (!syncPath) {
    const entry = defaultChapterMediaEntry();
    syncPath = entry.syncOutputPath;
    alignPath = alignPath ?? entry.alignInputPath;
  }

  return {
    syncPath: resolveRepoPath(syncPath),
    alignPath: alignPath ? resolveRepoPath(alignPath) : null,
  };
}

function main(): void {
  const { syncPath, alignPath } = parseArgs();

  if (!existsSync(syncPath)) {
    console.warn(`SKIP: sync file not found: ${syncPath}`);
    console.warn('Run WhisperX alignment first (see scripts/alignment/whisperx/COLAB.md)');
    process.exit(0);
  }

  const asset = loadJson<ChapterSyncAsset>(syncPath);
  let alignInput: ChapterAlignInput | undefined;
  if (alignPath && existsSync(alignPath)) {
    alignInput = loadJson<ChapterAlignInput>(alignPath);
  }

  const result = validateSyncAsset(asset, alignInput);

  for (const warning of result.warnings) {
    console.warn(`warn: ${warning}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`error: ${error}`);
    }
    process.exit(1);
  }

  const wordCount = asset.sentences.reduce((n, s) => n + s.words.length, 0);
  console.log(`OK: ${asset.chapter_slug}`);
  console.log(`  sync_version:     ${asset.sync_version}`);
  console.log(`  audio_offset_ms:  ${asset.audio_offset_ms}`);
  console.log(`  sentences:        ${asset.sentences.length}`);
  console.log(`  words:            ${wordCount}`);
  console.log(`  duration_ms:      ${asset.sentences.at(-1)?.end_ms ?? 0}`);

  const pending = chapterMediaManifest.filter(
    (entry) => !existsSync(resolveRepoPath(entry.syncOutputPath)),
  );
  if (pending.length > 0) {
    console.log(`  pending align:    ${pending.map((e) => `${e.bookSlug} ch.${e.chapterIndex}`).join(', ')}`);
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('validateSyncAsset.ts') ||
    process.argv[1].endsWith('validateSyncAsset'));
if (isDirectRun) {
  main();
}
