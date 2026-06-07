/**
 * useTextSelection — Manages word/sentence selection state for the reader.
 *
 * Selection model:
 *   - Long-press word (any mode) → starts selection range
 *   - Tap word, NOT playing     → same as long-press (definition card)
 *   - Tap word, PLAYING         → seek audio (no selection change)
 *   - Drag handles             → expands selection across words/sentences
 *   - Multi-word/sentence      → definition card hides, toolbar shows full range
 */
import { useCallback, useState } from 'react';
import { fetchDefinition } from '../services/dictionary/dictionaryService';
import { askAi } from '../services/ai/askAi';
import type { Sentence, WordTimestamp } from '../types';

export type { WordDefinition } from '../services/dictionary/dictionaryService';

export const TRANSLATE_LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
] as const;

export type TranslateLanguageCode = (typeof TRANSLATE_LANGUAGES)[number]['code'];

export interface TextSelection {
  /** The sentence of the initially selected word (anchor for definition lookup). */
  sentence: Sentence;
  wordIndex: number;
  word: WordTimestamp;
  /** Container-relative Y of the anchor word — for toolbar positioning. */
  anchorY: number;

  /** Selection Range */
  startSentenceIndex: number;
  startWordIndex: number;
  endSentenceIndex: number;
  endWordIndex: number;
}

export interface UseTextSelectionReturn {
  selection: TextSelection | null;
  definition: import('../services/dictionary/dictionaryService').WordDefinition | null;
  isLoadingDefinition: boolean;
  translatedText: string | null;
  translationError: string | null;
  isTranslating: boolean;
  /** True when more than one word is selected. */
  isMultiWord: boolean;

  selectWord: (
    sentence: Sentence,
    wordIndex: number,
    word: WordTimestamp,
    anchorY: number,
  ) => void;

  updateSelectionRange: (
    sentenceIndex: number,
    wordIndex: number,
    dragType: 'start' | 'end',
  ) => void;

  getSelectedText: (sentences: Sentence[]) => string;
  clearSelection: () => void;
  translateWord: (params: {
    targetLanguage: string;
    bookSlug: string;
    chapterSlug: string;
  }) => Promise<void>;
  defineSelection: () => void;
}

export function useTextSelection(): UseTextSelectionReturn {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [definition, setDefinition] = useState<import('../services/dictionary/dictionaryService').WordDefinition | null>(null);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const defineSelection = useCallback(() => {
    if (!selection) return;
    // Only support defining single words
    if (selection.startSentenceIndex !== selection.endSentenceIndex || selection.startWordIndex !== selection.endWordIndex) {
      return;
    }

    setIsLoadingDefinition(true);
    fetchDefinition(selection.word.word)
      .then((def) => setDefinition(def))
      .catch(() => setDefinition(null))
      .finally(() => setIsLoadingDefinition(false));
  }, [selection]);

  const selectWord = useCallback(
    (
      sentence: Sentence,
      wordIndex: number,
      word: WordTimestamp,
      anchorY: number,
    ) => {
      setTranslatedText(null);
      setTranslationError(null);
      setSelection({
        sentence,
        wordIndex,
        word,
        anchorY,
        startSentenceIndex: sentence.index,
        startWordIndex: wordIndex,
        endSentenceIndex: sentence.index,
        endWordIndex: wordIndex,
      });

      setDefinition(null);
      setIsLoadingDefinition(false);
    },
    [],
  );

  const updateSelectionRange = useCallback(
    (sentenceIndex: number, wordIndex: number, dragType: 'start' | 'end') => {
      setSelection((prev) => {
        if (!prev) return prev;

        let { startSentenceIndex, startWordIndex, endSentenceIndex, endWordIndex } = prev;

        if (dragType === 'start') {
          // Prevent start from crossing end
          if (
            sentenceIndex > endSentenceIndex ||
            (sentenceIndex === endSentenceIndex && wordIndex > endWordIndex)
          ) {
            startSentenceIndex = endSentenceIndex;
            startWordIndex = endWordIndex;
          } else {
            startSentenceIndex = sentenceIndex;
            startWordIndex = wordIndex;
          }
        } else {
          // Prevent end from crossing start
          if (
            sentenceIndex < startSentenceIndex ||
            (sentenceIndex === startSentenceIndex && wordIndex < startWordIndex)
          ) {
            endSentenceIndex = startSentenceIndex;
            endWordIndex = startWordIndex;
          } else {
            endSentenceIndex = sentenceIndex;
            endWordIndex = wordIndex;
          }
        }

        // If range changed, clear single-word definitions
        if (
          startSentenceIndex !== prev.startSentenceIndex ||
          startWordIndex !== prev.startWordIndex ||
          endSentenceIndex !== prev.endSentenceIndex ||
          endWordIndex !== prev.endWordIndex
        ) {
          setDefinition(null);
          setTranslatedText(null);
          setTranslationError(null);
        }

        return {
          ...prev,
          startSentenceIndex,
          startWordIndex,
          endSentenceIndex,
          endWordIndex,
        };
      });
    },
    [],
  );

  const getSelectedText = useCallback(
    (sentences: Sentence[]): string => {
      if (!selection) return '';
      const parts: string[] = [];

      for (let i = selection.startSentenceIndex; i <= selection.endSentenceIndex; i++) {
        const s = sentences[i];
        if (!s) continue;

        const startIdx = i === selection.startSentenceIndex ? selection.startWordIndex : 0;
        const endIdx =
          i === selection.endSentenceIndex ? selection.endWordIndex : s.words.length - 1;

        const words = s.words.slice(startIdx, endIdx + 1).map((w) => w.word);
        parts.push(words.join(' '));
      }

      return parts.join(' ');
    },
    [selection],
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
    setDefinition(null);
    setTranslatedText(null);
    setTranslationError(null);
  }, []);

  const translateWord = useCallback(
    async (params: {
      targetLanguage: string;
      bookSlug: string;
      chapterSlug: string;
    }) => {
      if (!selection) return;
      setTranslatedText(null);
      setTranslationError(null);
      setIsTranslating(true);
      try {
        const response = await askAi({
          book_slug: params.bookSlug,
          chapter_slug: params.chapterSlug,
          sentence_id: selection.sentence.id,
          sentence_text: selection.sentence.text,
          surrounding_sentences: [],
          user_prompt: `Translate the word "${selection.word.word}" to ${params.targetLanguage}. Reply with: the translated word, its part of speech in ${params.targetLanguage}, and a short example sentence. Be concise.`,
        });
        if (response?.answer) {
          setTranslatedText(response.answer);
        } else {
          setTranslationError('Translation returned an empty response.');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Translation failed. Check your connection.';
        setTranslationError(message);
      } finally {
        setIsTranslating(false);
      }
    },
    [selection],
  );

  const isMultiWord = selection
    ? selection.startSentenceIndex !== selection.endSentenceIndex ||
      selection.startWordIndex !== selection.endWordIndex
    : false;

  return {
    selection,
    definition,
    isLoadingDefinition,
    translatedText,
    translationError,
    isTranslating,
    isMultiWord,
    selectWord,
    updateSelectionRange,
    getSelectedText,
    clearSelection,
    translateWord,
    defineSelection,
  };
}
