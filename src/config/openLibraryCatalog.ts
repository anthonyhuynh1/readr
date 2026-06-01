/**
 * Curated Open Library work IDs for the Explore catalog.
 * @see https://openlibrary.org/developers/api
 */
export const OPEN_LIBRARY_WORK_IDS = [
  'OL468431W', // The Great Gatsby
  'OL262463W', // The Adventures of Sherlock Holmes
  'OL45804W', // Meditations
  'OL7178347W', // Alice's Adventures in Wonderland
  'OL244042W', // The Art of War
] as const;

export type OpenLibraryWorkId = (typeof OPEN_LIBRARY_WORK_IDS)[number];

/** Optional slug override when OL title slug differs from our mock JSON slug. */
export const OPEN_LIBRARY_SLUG_OVERRIDES: Partial<Record<OpenLibraryWorkId, string>> = {
  OL468431W: 'the-great-gatsby',
  OL262463W: 'the-adventures-of-sherlock-holmes',
  OL45804W: 'meditations',
  OL7178347W: 'alices-adventures-in-wonderland',
  OL244042W: 'the-art-of-war',
};
