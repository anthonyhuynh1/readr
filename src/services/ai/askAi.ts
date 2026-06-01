import { env } from '../../config/env';
import type { AskAiRequest, AskAiResponse } from '../../types';
import { apiRequest } from '../api/client';

function fallbackAnswer(request: AskAiRequest): AskAiResponse {
  const neighbors = request.surrounding_sentences.slice(0, 2).join(' ');
  return {
    answer: `Interpretation: "${request.sentence_text}" suggests a key thematic signal in this chapter. Contextual cue: ${neighbors || 'No nearby sentences provided.'}`,
    thread_id: `local-thread-${request.chapter_slug}`,
    message_id: `local-msg-${Date.now()}`,
  };
}

export async function askAi(request: AskAiRequest): Promise<AskAiResponse> {
  try {
    return await apiRequest<AskAiResponse>('/v1/ask-ai', {
      method: 'POST',
      body: JSON.stringify(request),
      requireAuth: true,
    });
  } catch (error) {
    if (env.askAiFallbackEnabled) {
      return fallbackAnswer(request);
    }
    throw error;
  }
}
