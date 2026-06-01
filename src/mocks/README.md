# Mock reading text

Local chapter text for development. Open Library supplies catalog metadata and covers; this file supplies what you can actually read in the app.

## Edit a chapter

1. Open [`mockBook.json`](./mockBook.json).
2. Add or edit entries in `chapters[].paragraphs` — **one array item = one sentence row** in the reader.
3. Reload the app (ensure **Reading text → Mock JSON** is selected in Profile dev settings).

## Add a chapter

```json
{
  "slug": "the-great-gatsby-ch-4",
  "title": "Chapter 4",
  "chapterIndex": 4,
  "pageNumber": 4,
  "paragraphs": ["First sentence…", "Second sentence…"]
}
```

Slugs must stay unique. `chapterIndex` controls TOC order.

## Match Open Library

Set `openLibraryWorkId` and `slug` to match [`openLibraryCatalog.ts`](../config/openLibraryCatalog.ts) overrides so the mock book aligns with the live catalog card.

Validate before commit:

```bash
npm run validate:mock-book
```
