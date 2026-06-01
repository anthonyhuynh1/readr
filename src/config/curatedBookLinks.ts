/**
 * External reading links for curated Open Library catalog titles.
 * Used when in-app text is not yet ingested (ReadUnavailable screen).
 */
export interface CuratedBookLinks {
  standardEbooksUrl?: string;
  /** Full URL, e.g. https://openlibrary.org/works/OL468431W */
  openLibraryUrl?: string;
}

export const CURATED_BOOK_LINKS: Record<string, CuratedBookLinks> = {
  'the-great-gatsby': {
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/f-scott-fitzgerald/the-great-gatsby',
    openLibraryUrl: 'https://openlibrary.org/works/OL468431W',
  },
  'the-adventures-of-sherlock-holmes': {
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/arthur-conan-doyle/the-adventures-of-sherlock-holmes',
    openLibraryUrl: 'https://openlibrary.org/works/OL262463W',
  },
  meditations: {
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/marcus-aurelius/meditations',
    openLibraryUrl: 'https://openlibrary.org/works/OL45804W',
  },
  'alices-adventures-in-wonderland': {
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland',
    openLibraryUrl: 'https://openlibrary.org/works/OL7178347W',
  },
  'the-art-of-war': {
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/sunzi/the-art-of-war',
    openLibraryUrl: 'https://openlibrary.org/works/OL244042W',
  },
};

export function getCuratedBookLinks(slug: string): CuratedBookLinks | undefined {
  return CURATED_BOOK_LINKS[slug];
}
