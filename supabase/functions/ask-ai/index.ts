/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AskAiPayload {
  book_slug: string;
  chapter_slug: string;
  sentence_id: string;
  sentence_text: string;
  surrounding_sentences: string[];
  user_prompt: string;
}

async function callOpenAi(payload: AskAiPayload): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const systemPrompt =
    'You are Readr AI. Give concise literary interpretation and avoid spoilers beyond nearby context.';

  const userPrompt = [
    `Book: ${payload.book_slug}`,
    `Chapter: ${payload.chapter_slug}`,
    `Sentence: ${payload.sentence_text}`,
    `Nearby context: ${payload.surrounding_sentences.join(' | ')}`,
    `User question: ${payload.user_prompt}`,
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI error: ${details}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content ?? 'No response available.';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await request.json()) as AskAiPayload;
    const answer = await callOpenAi(payload);
    return new Response(
      JSON.stringify({
        answer,
        thread_id: `thread-${payload.chapter_slug}`,
        message_id: `msg-${Date.now()}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
