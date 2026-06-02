import { join } from 'node:path';

/** Registry entry for chapters with local audio + WhisperX alignment pipeline. */
export interface ChapterMediaEntry {
  bookSlug: string;
  chapterIndex: number;
  /** Repo-relative path to LibriVox (or other) MP3. */
  audioLocalPath: string;
  /** Repo-relative path for alignment input JSON (extract output). */
  alignInputPath: string;
  /** Repo-relative path for aligned ChapterSyncAsset JSON. */
  syncOutputPath: string;
}

const ROOT = process.cwd();

/** Chapters enabled for real audio + alignment. Add rows here as books scale. */
export const chapterMediaManifest: ChapterMediaEntry[] = [
  {
    bookSlug: 'the-great-gatsby',
    chapterIndex: 1,
    audioLocalPath: 'assets/audio/gatsby-ch1-librivox.mp3',
    alignInputPath: 'assets/align/the-great-gatsby/ch-1-sentences.json',
    syncOutputPath: 'assets/sync/the-great-gatsby/ch-1.json',
  },
];

export function resolveRepoPath(relativePath: string): string {
  return join(ROOT, relativePath);
}

export function findChapterMediaEntry(
  bookSlug: string,
  chapterIndex: number,
): ChapterMediaEntry | undefined {
  return chapterMediaManifest.find(
    (entry) => entry.bookSlug === bookSlug && entry.chapterIndex === chapterIndex,
  );
}

export function findChapterMediaBySlug(chapterSlug: string): ChapterMediaEntry | undefined {
  const match = /^(.+)-ch-(\d+)$/.exec(chapterSlug);
  if (!match) return undefined;
  const chapterIndex = Number.parseInt(match[2], 10);
  if (!Number.isFinite(chapterIndex)) return undefined;
  return findChapterMediaEntry(match[1], chapterIndex);
}

/** Default entry for CLI scripts (first manifest row). */
export function defaultChapterMediaEntry(): ChapterMediaEntry {
  const entry = chapterMediaManifest[0];
  if (!entry) {
    throw new Error('chapterMediaManifest is empty — add at least one chapter entry');
  }
  return entry;
}
