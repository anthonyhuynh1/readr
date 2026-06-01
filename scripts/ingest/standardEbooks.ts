/**
 * Standard Ebooks EPUB → mockBook.json ingest pipeline.
 * Uses cheerio to extract plain text from semantic XHTML (no raw tags).
 */
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import JSZip from 'jszip';

export interface IngestChapter {
  slug: string;
  title: string;
  chapterIndex: number;
  pageNumber: number;
  paragraphs: string[];
}

export interface IngestBookConfig {
  slug: string;
  title: string;
  author: string;
  description: string;
  standardEbooksUrl: string;
  librivoxUrl?: string;
  openLibraryWorkId?: string;
  epubUrl: string;
  /** Standard Ebooks GitHub repo, e.g. standardebooks/f-scott-fitzgerald_the-great-gatsby */
  githubRepo?: string;
}

export interface MockBookOutput {
  schema_version: 1;
  slug: string;
  title: string;
  author: string;
  description: string;
  standardEbooksUrl: string;
  librivoxUrl?: string;
  openLibraryWorkId?: string;
  chapters: IngestChapter[];
}

const SKIP_SPINE_ID_RE =
  /titlepage|halftitle|imprint|colophon|uncopyright|toc|dedication|landmarks|loi|lot|frontmatter|copyright/i;

const SKIP_HREF_RE =
  /titlepage|colophon|imprint|uncopyright|halftitle|toc\.|dedication|frontmatter/i;

/** Collapse whitespace; normalize unicode spaces and dashes. */
export function normalizeParagraphText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function resolveHref(opfDir: string, href: string): string {
  if (href.startsWith('/')) return href.slice(1);
  if (!opfDir) return href;
  const parts = `${opfDir}/${href}`.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function parseContainerPath(containerXml: string): string {
  const match = containerXml.match(/full-path="([^"]+)"/i);
  if (!match) throw new Error('EPUB container.xml missing full-path');
  return match[1];
}

interface OpfSpineItem {
  id: string;
  href: string;
}

function parseOpf(opfXml: string, opfPath: string): OpfSpineItem[] {
  const opfDir = opfPath.includes('/') ? opfPath.replace(/\/[^/]+$/, '') : '';

  const manifest = new Map<string, string>();
  for (const match of opfXml.matchAll(/<item\b[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"[^>]*>/gi)) {
    manifest.set(match[1], resolveHref(opfDir, match[2]));
  }
  for (const match of opfXml.matchAll(/<item\b[^>]*\bhref="([^"]+)"[^>]*\bid="([^"]+)"[^>]*>/gi)) {
    manifest.set(match[2], resolveHref(opfDir, match[1]));
  }

  const spineIds: string[] = [];
  for (const match of opfXml.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"[^>]*>/gi)) {
    spineIds.push(match[1]);
  }

  const items: OpfSpineItem[] = [];
  for (const id of spineIds) {
    if (SKIP_SPINE_ID_RE.test(id)) continue;
    const href = manifest.get(id);
    if (!href || SKIP_HREF_RE.test(href)) continue;
    if (!href.endsWith('.xhtml') && !href.endsWith('.html')) continue;
    items.push({ id, href });
  }

  return items;
}

function isInsideFootnote($: cheerio.CheerioAPI, el: Element): boolean {
  return $(el)
    .parents()
    .toArray()
    .some((parent) => {
      const type = $(parent).attr('epub:type') ?? '';
      return type.includes('footnote') || type.includes('endnote');
    });
}

function extractParagraphsFromHtml(html: string): { title: string; paragraphs: string[] } {
  const $ = cheerio.load(html, { xml: false });

  $('script, style, nav, header, footer, aside').remove();

  const title = normalizeParagraphText($('h2, h3').first().text()) || 'Chapter';
  const paragraphs: string[] = [];

  $('p').each((_, el) => {
    if (isInsideFootnote($, el)) return;
    const text = normalizeParagraphText($(el).text());
    if (text) paragraphs.push(text);
  });

  return { title, paragraphs };
}

function isLikelyBodyChapter(paragraphs: string[]): boolean {
  if (paragraphs.length < 3) return false;
  const joined = paragraphs.join(' ');
  if (joined.length < 400) return false;
  if (/^The Standard Ebooks/i.test(paragraphs[0] ?? '')) return false;
  if (/^This ebook is/i.test(paragraphs[0] ?? '')) return false;
  return true;
}

export async function downloadEpub(epubUrl: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(epubUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Readr-Ingest/1.0 (https://github.com/readr)' },
    });
    if (!res.ok) {
      throw new Error(`Failed to download EPUB (${res.status}): ${epubUrl}`);
    }
    return res.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadEpubFromFile(filePath: string): Promise<ArrayBuffer> {
  const { readFileSync } = await import('node:fs');
  const buf = readFileSync(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export async function parseEpubToChapters(
  epubBuffer: ArrayBuffer,
  bookSlug: string,
): Promise<IngestChapter[]> {
  const zip = await JSZip.loadAsync(epubBuffer);

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Invalid EPUB: missing META-INF/container.xml');

  const containerXml = await containerFile.async('string');
  const opfPath = parseContainerPath(containerXml);

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error(`Invalid EPUB: missing OPF at ${opfPath}`);

  const opfXml = await opfFile.async('string');
  const spineItems = parseOpf(opfXml, opfPath);

  const chapters: IngestChapter[] = [];
  let chapterIndex = 0;

  for (const item of spineItems) {
    const file = zip.file(item.href);
    if (!file) continue;

    const html = await file.async('string');
    const { title, paragraphs } = extractParagraphsFromHtml(html);
    if (!isLikelyBodyChapter(paragraphs)) continue;

    chapterIndex += 1;
    chapters.push({
      slug: `${bookSlug}-ch-${chapterIndex}`,
      title: title.match(/^chapter\s+\d+/i) ? title : `Chapter ${chapterIndex}`,
      chapterIndex,
      pageNumber: chapterIndex,
      paragraphs,
    });
  }

  if (chapters.length === 0) {
    throw new Error('No chapters extracted from EPUB spine');
  }

  return chapters;
}

export async function ingestFromGithubRepo(
  config: IngestBookConfig,
): Promise<IngestChapter[]> {
  if (!config.githubRepo) {
    throw new Error('githubRepo is required for GitHub ingest');
  }

  const apiUrl = `https://api.github.com/repos/${config.githubRepo}/contents/src/epub/text`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Readr-Ingest/1.0', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`GitHub API failed (${res.status}): ${apiUrl}`);
  }

  const entries = (await res.json()) as Array<{ name: string; download_url: string }>;
  const chapterFiles = entries
    .filter((entry) => /^chapter-\d+\.xhtml$/i.test(entry.name))
    .sort((a, b) => {
      const ai = Number(a.name.match(/(\d+)/)?.[1] ?? 0);
      const bi = Number(b.name.match(/(\d+)/)?.[1] ?? 0);
      return ai - bi;
    });

  if (chapterFiles.length === 0) {
    throw new Error(`No chapter-*.xhtml files in ${config.githubRepo}`);
  }

  const chapters: IngestChapter[] = [];

  for (const file of chapterFiles) {
    const chapterIndex = Number(file.name.match(/(\d+)/)?.[1] ?? chapters.length + 1);
    const htmlRes = await fetch(file.download_url, {
      headers: { 'User-Agent': 'Readr-Ingest/1.0' },
    });
    if (!htmlRes.ok) {
      throw new Error(`Failed to fetch ${file.name} (${htmlRes.status})`);
    }
    const html = await htmlRes.text();
    const { title, paragraphs } = extractParagraphsFromHtml(html);
    if (!isLikelyBodyChapter(paragraphs)) {
      throw new Error(`Chapter ${file.name} failed body heuristics (${paragraphs.length} ¶)`);
    }

    chapters.push({
      slug: `${config.slug}-ch-${chapterIndex}`,
      title: title.match(/^chapter\s+\d+/i) ? title : `Chapter ${chapterIndex}`,
      chapterIndex,
      pageNumber: chapterIndex,
      paragraphs,
    });
  }

  return chapters;
}

export async function ingestStandardEbook(
  config: IngestBookConfig,
  epubBuffer?: ArrayBuffer,
): Promise<MockBookOutput> {
  let chapters: IngestChapter[];

  if (epubBuffer) {
    chapters = await parseEpubToChapters(epubBuffer, config.slug);
  } else if (config.githubRepo) {
    chapters = await ingestFromGithubRepo(config);
  } else {
    const buffer = await downloadEpub(config.epubUrl);
    chapters = await parseEpubToChapters(buffer, config.slug);
  }

  return {
    schema_version: 1,
    slug: config.slug,
    title: config.title,
    author: config.author,
    description: config.description,
    standardEbooksUrl: config.standardEbooksUrl,
    librivoxUrl: config.librivoxUrl,
    openLibraryWorkId: config.openLibraryWorkId,
    chapters,
  };
}

export function assertCleanParagraphs(book: MockBookOutput): void {
  const tagRe = /<[^>]+>/;
  for (const chapter of book.chapters) {
    for (const paragraph of chapter.paragraphs) {
      if (tagRe.test(paragraph)) {
        throw new Error(
          `HTML tag leakage in ${chapter.slug}: ${paragraph.slice(0, 80)}…`,
        );
      }
      if (!paragraph.trim()) {
        throw new Error(`Empty paragraph in ${chapter.slug}`);
      }
    }
  }
}

export const GATSBY_INGEST_CONFIG: IngestBookConfig = {
  slug: 'the-great-gatsby',
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  description:
    'A Jazz Age novel of longing, status, and illusion set on Long Island.',
  standardEbooksUrl:
    'https://standardebooks.org/ebooks/f-scott-fitzgerald/the-great-gatsby',
  librivoxUrl: 'https://librivox.org/the-great-gatsby-by-f-scott-fitzgerald/',
  openLibraryWorkId: 'OL468431W',
  epubUrl:
    'https://standardebooks.org/ebooks/f-scott-fitzgerald/the-great-gatsby/downloads/fitzgerald_the-great-gatsby.epub',
  githubRepo: 'standardebooks/f-scott-fitzgerald_the-great-gatsby',
};

/** @deprecated Use ingestStandardEbook — kept for metadata scaffold callers. */
export { GATSBY_INGEST_CONFIG as gatsbyConfig };
