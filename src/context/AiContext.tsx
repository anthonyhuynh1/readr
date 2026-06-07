/**
 * AiContext — Manages Ask AI sheet visibility, context sentence, and submission.
 * Isolated from playback concerns; receives book/chapter context as parameters.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { askAi } from '../services/ai/askAi';
import type { AskAiResponse, Sentence } from '../types';

/** Public surface exposed by AiContext. */
export interface AiContextValue {
  aiSheetVisible: boolean;
  aiContextSentence: Sentence | null;
  aiResponse: AskAiResponse | null;
  isAskingAi: boolean;
  openAskAi: (sentence: Sentence) => void;
  closeAskAi: () => void;
  submitAskAi: (params: {
    userPrompt: string;
    bookSlug: string;
    chapterSlug: string;
    sentences: Sentence[];
  }) => Promise<void>;
}

const AiCtx = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [aiContextSentence, setAiContextSentence] = useState<Sentence | null>(null);
  const [aiResponse, setAiResponse] = useState<AskAiResponse | null>(null);
  const [isAskingAi, setIsAskingAi] = useState(false);

  const openAskAi = useCallback((sentence: Sentence) => {
    setAiContextSentence(sentence);
    setAiResponse(null);
    setAiSheetVisible(true);
  }, []);

  const closeAskAi = useCallback(() => {
    setAiSheetVisible(false);
    setAiContextSentence(null);
    setAiResponse(null);
  }, []);

  const submitAskAi = useCallback(
    async (params: {
      userPrompt: string;
      bookSlug: string;
      chapterSlug: string;
      sentences: Sentence[];
    }) => {
      if (!aiContextSentence) return;
      setIsAskingAi(true);
      try {
        const neighborhood = params.sentences
          .filter(
            (entry) =>
              Math.abs(entry.index - aiContextSentence.index) <= 1 &&
              entry.id !== aiContextSentence.id,
          )
          .map((entry) => entry.text);

        const response = await askAi({
          book_slug: params.bookSlug,
          chapter_slug: params.chapterSlug,
          sentence_id: aiContextSentence.id,
          sentence_text: aiContextSentence.text,
          surrounding_sentences: neighborhood,
          user_prompt: params.userPrompt,
        });
        setAiResponse(response);
      } finally {
        setIsAskingAi(false);
      }
    },
    [aiContextSentence],
  );

  const value = useMemo<AiContextValue>(
    () => ({
      aiSheetVisible,
      aiContextSentence,
      aiResponse,
      isAskingAi,
      openAskAi,
      closeAskAi,
      submitAskAi,
    }),
    [aiSheetVisible, aiContextSentence, aiResponse, isAskingAi, openAskAi, closeAskAi, submitAskAi],
  );

  return <AiCtx.Provider value={value}>{children}</AiCtx.Provider>;
}

/** Access AI sheet state and actions. Must be used within an AiProvider. */
export function useAi(): AiContextValue {
  const ctx = useContext(AiCtx);
  if (!ctx) {
    throw new Error('useAi must be used within an AiProvider');
  }
  return ctx;
}
