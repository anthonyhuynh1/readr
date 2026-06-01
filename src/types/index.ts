/**
 * Readr — core domain types for bimodal reading (v2 slug-based model).
 */

export interface WordTimestamp {
  index: number;
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface Sentence {
  id: string;
  index: number;
  text: string;
  pageNumber: number;
  words: WordTimestamp[];
}

export interface Chapter {
  slug: string;
  bookSlug: string;
  title: string;
  chapterIndex: number;
  pageNumber: number;
  durationMs: number;
  sentences: Sentence[];
  audioPath: string;
  syncMetadataPath: string;
  audioOffsetMs: number;
  syncHash: string;
  syncVersion: number;
  /** Storage path in `text/` bucket (production reading payload). */
  textMetadataPath?: string;
  textHash?: string;
}

export interface BookCatalogItem {
  slug: string;
  title: string;
  author: string;
  coverImageUrl: string;
  openLibraryWorkId?: string;
}

export interface Book {
  slug: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl: string;
  standardEbooksUrl: string;
  librivoxUrl: string;
  openLibraryWorkId?: string;
  chapters: Chapter[];
}

export interface Bookmark {
  id: string;
  user_id: string;
  book_slug: string;
  book_title: string;
  chapter_slug: string;
  chapter_title: string;
  sentence_id: string;
  page_hint: number;
  line_index: number;
  text_preview: string;
  timestamp_start_ms: number;
  created_at: string;
  pending_sync?: boolean;
}

export interface PendingBookmarkMutation {
  id: string;
  type: 'upsert' | 'delete';
  payload: Bookmark | { id: string; user_id: string };
  created_at: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface AiThread {
  id: string;
  user_id: string;
  book_slug: string;
  chapter_slug: string;
  sentence_id: string;
  title: string;
  messages: AiMessage[];
}

export interface AskAiRequest {
  book_slug: string;
  chapter_slug: string;
  sentence_id: string;
  sentence_text: string;
  surrounding_sentences: string[];
  user_prompt: string;
}

export interface AskAiResponse {
  answer: string;
  thread_id: string;
  message_id: string;
}

export interface SyncPosition {
  sentenceIndex: number;
  wordIndex: number;
  sentence: Sentence | null;
  word: WordTimestamp | null;
}

export interface IndexedWord {
  globalIndex: number;
  sentenceIndex: number;
  wordIndex: number;
  word: WordTimestamp;
}
