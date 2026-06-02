/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AskAiPayload {
  book_slug: string;
  chapter_slug: string;
  sentence_id: string;
  sentence_text: string;
  surrounding_sentences: string[];
  user_prompt: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

async function verifyJwt(request: Request): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token' };
  }

  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, message: 'Supabase auth is not configured' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    return { ok: false, status: 401, message: 'Invalid or expired session' };
  }

  return { ok: true };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await verifyJwt(request);
  if (!auth.ok) {
    return jsonResponse({ error: auth.message }, auth.status);
  }

  try {
    const payload = (await request.json()) as AskAiPayload;
    const answer = await callOpenAi(payload);
    return jsonResponse({
      answer,
      thread_id: `thread-${payload.chapter_slug}`,
      message_id: `msg-${Date.now()}`,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});
