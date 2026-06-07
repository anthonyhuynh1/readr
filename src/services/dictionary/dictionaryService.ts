/**
 * dictionaryService — Fetches word definitions from the Free Dictionary API.
 * No API key required. Falls back gracefully when the word is not found.
 * https://dictionaryapi.dev/
 */

export interface WordDefinition {
  word: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  definition: string;
  example: string | null;
}

const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Fetch the primary definition of a single English word.
 * Returns null if the word is not found or the network request fails.
 */
export async function fetchDefinition(word: string): Promise<WordDefinition | null> {
  // Strip punctuation so "world," and "world" both resolve.
  const cleaned = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
  if (!cleaned) return null;

  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(cleaned)}`);
    if (!res.ok) return null;

    const data = (await res.json()) as DictionaryApiEntry[];
    const entry = data[0];
    if (!entry) return null;

    // Find the first meaning with at least one definition.
    const meaning = entry.meanings?.find((m) => m.definitions?.length > 0);
    if (!meaning) return null;

    const def = meaning.definitions[0];
    return {
      word: entry.word,
      phonetic: entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text ?? null,
      partOfSpeech: meaning.partOfSpeech ?? null,
      definition: def.definition,
      example: def.example ?? null,
    };
  } catch {
    return null;
  }
}

// ── API response shape (typed minimally for what we use) ──────────────────────

interface DictionaryApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions: { definition: string; example?: string }[];
  }[];
}
