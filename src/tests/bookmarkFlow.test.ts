import { describe, expect, it } from 'vitest';
import { seededBooks } from '../data/mockChapter';
import { groupBookmarks } from '../utils/bookmarks';
import type { Bookmark } from '../types';

describe('bookmark grouping and ordering', () => {
  it('groups bookmarks by chapter and page in deterministic order', () => {
    const book = seededBooks[0];
    const chapter = book.chapters[0];
    const bookmarks: Bookmark[] = [
      {
        id: 'b2',
        user_id: 'u1',
        book_slug: book.slug,
        book_title: book.title,
        chapter_slug: chapter.slug,
        chapter_title: chapter.title,
        sentence_id: `${chapter.slug}-s-1`,
        page_hint: 2,
        line_index: 5,
        text_preview: 'second',
        timestamp_start_ms: 4000,
        created_at: new Date().toISOString(),
      },
      {
        id: 'b1',
        user_id: 'u1',
        book_slug: book.slug,
        book_title: book.title,
        chapter_slug: chapter.slug,
        chapter_title: chapter.title,
        sentence_id: `${chapter.slug}-s-0`,
        page_hint: 1,
        line_index: 1,
        text_preview: 'first',
        timestamp_start_ms: 1000,
        created_at: new Date().toISOString(),
      },
    ];

    const grouped = groupBookmarks(book, bookmarks);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].pages[0].pageNumber).toBe(1);
    expect(grouped[0].pages[0].bookmarks[0].id).toBe('b1');
  });
});
