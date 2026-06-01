import type { Book, Bookmark } from '../types';

/** Sort bookmarks by chapter order, then page, then line within page. */
export function sortBookmarks(book: Book, bookmarks: Bookmark[]): Bookmark[] {
  const chapterOrder = new Map(
    book.chapters.map((chapter, index) => [chapter.slug, index]),
  );

  return [...bookmarks].sort((a, b) => {
    const chapterDiff =
      (chapterOrder.get(a.chapter_slug) ?? 0) -
      (chapterOrder.get(b.chapter_slug) ?? 0);
    if (chapterDiff !== 0) return chapterDiff;
    if (a.page_hint !== b.page_hint) return a.page_hint - b.page_hint;
    return a.line_index - b.line_index;
  });
}

export interface BookmarkChapterGroup {
  chapterSlug: string;
  chapterTitle: string;
  pages: BookmarkPageGroup[];
}

export interface BookmarkPageGroup {
  pageNumber: number;
  bookmarks: Bookmark[];
}

/** Group sorted bookmarks into chapter → page hierarchy for display. */
export function groupBookmarks(
  book: Book,
  bookmarks: Bookmark[],
): BookmarkChapterGroup[] {
  const sorted = sortBookmarks(book, bookmarks);
  const groups: BookmarkChapterGroup[] = [];

  for (const bookmark of sorted) {
    let chapterGroup = groups.find((g) => g.chapterSlug === bookmark.chapter_slug);
    if (!chapterGroup) {
      chapterGroup = {
        chapterSlug: bookmark.chapter_slug,
        chapterTitle: bookmark.chapter_title,
        pages: [],
      };
      groups.push(chapterGroup);
    }

    let pageGroup = chapterGroup.pages.find(
      (p) => p.pageNumber === bookmark.page_hint,
    );
    if (!pageGroup) {
      pageGroup = { pageNumber: bookmark.page_hint, bookmarks: [] };
      chapterGroup.pages.push(pageGroup);
    }

    pageGroup.bookmarks.push(bookmark);
  }

  return groups;
}
