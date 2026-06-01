# Readr

Premium bimodal reading app with synchronized text/audio playback, cloud bookmarks,
and sentence-context AI interpretation.

## Environment

Copy `.env.example` to `.env` and fill values:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_ASK_AI_FALLBACK=true
```

## Key Architecture

- `src/context/AuthContext.tsx` — Supabase auth state and magic-link sign-in.
- `src/context/PlaybackContext.tsx` — playback timer, catalog/chapter selection, bookmarks, AI state.
- `src/services/` — typed API client + auth/content/bookmark/AI repositories.
- `supabase/migrations/` — schema, alignment tables, and RLS policies.
- `supabase/functions/ask-ai/index.ts` — managed LLM proxy edge function.
- `scripts/ingest/` and `scripts/alignment/` — content and timestamp seed scaffolds.

## Local Development

```bash
npm install
npm run start
```

## Verification

```bash
npm run typecheck
npm run lint
npm run test
```
