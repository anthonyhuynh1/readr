/** Fallback cover URLs and colors when Open Library cover is unavailable. */
export const bookCoverUrls: Record<string, string> = {
  'the-great-gatsby':
    'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
  'the-adventures-of-sherlock-holmes':
    'https://covers.openlibrary.org/b/title/The%20Adventures%20of%20Sherlock%20Holmes-L.jpg',
  meditations:
    'https://covers.openlibrary.org/b/title/Meditations%20Marcus%20Aurelius-L.jpg',
  'alices-adventures-in-wonderland':
    'https://covers.openlibrary.org/b/title/Alice%27s%20Adventures%20in%20Wonderland-L.jpg',
  'the-art-of-war':
    'https://covers.openlibrary.org/b/title/The%20Art%20of%20War-L.jpg',
};

/** Accent colors for cover fallback when remote image fails. */
export const bookCoverColors: Record<string, { bg: string; accent: string }> = {
  'the-great-gatsby': { bg: '#1a3a2f', accent: '#d4af37' },
  'the-adventures-of-sherlock-holmes': { bg: '#2c1810', accent: '#c9a227' },
  meditations: { bg: '#3d3d3d', accent: '#9e9e9e' },
  'alices-adventures-in-wonderland': { bg: '#1e3a5f', accent: '#7ec8e3' },
  'the-art-of-war': { bg: '#4a0e0e', accent: '#c0392b' },
};

export function getBookCoverUrl(bookSlug: string, fallbackUrl?: string): string | null {
  return fallbackUrl ?? bookCoverUrls[bookSlug] ?? null;
}

export function getBookCoverColors(bookSlug: string) {
  return (
    bookCoverColors[bookSlug] ?? { bg: '#1a1a1a', accent: '#FF6B00' }
  );
}
