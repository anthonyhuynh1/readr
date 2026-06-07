---
name: Readr Supabase-only reading core
overview: Remove all mock/seed data at runtime so Supabase is the single source of truth, generalize the audio + sync pipeline and runtime to be fully data-driven (no hardcoded Gatsby ch.1), harden karaoke reliability, and prove the whole stack end-to-end on the full Gatsby book (9 chapters) with real audio.
todos:
  - id: fix-audio-gating
    content: "P0: Decouple sync-timing load from audioEnabled in supabaseContent (load real WhisperX timings whenever sync_hash exists); audioEnabled only controls audio playback. Prevents karaoke regression when mock is removed."
    status: completed
  - id: harden-offline
    content: "P0: Harden loadChapterTextAsset/loadChapterSyncAsset with try/catch + cached fallback; keep an explicit slug-keyed bundled Gatsby ch.1 (text+sync) offline fallback (NOT chapterIndex-based)."
    status: completed
  - id: supabase-verify
    content: "P0: Verify Supabase holds full Gatsby ch.1 data (book, chapter, text, sync, audio Storage); confirm app plays ch.1 + real karaoke from Supabase with mock paths force-disabled."
    status: completed
  - id: karaoke-reliability
    content: "P1 (Phase D): Fix FlashList recycling/scroll (getItemType static vs karaoke, use visibleIndicesRef, heights), stabilize Static<->ActiveKaraoke row swap, reduce clock lag, apply playbackRate in fallback clock. Prove on ch.1."
    status: completed
  - id: content-source
    content: "P2 (Phase A1): Collapse useContentStore to Supabase-only text/catalog; remove dev source toggles in ProfileScreen (keep an Audio on/off control wired to playback only)."
    status: completed
  - id: repository-supabase
    content: "P2 (Phase A2): Route fetchChapter/fetchCatalog/fetchBooks/canReadBook/refreshReadableBookSlugs through Supabase only; delete seed/mock branches."
    status: completed
  - id: playback-loading-gate
    content: "P2 (Phase A3): Add a loading gate at AppShell/navigation so reading screens mount only with a real chapter; remove mockBook/mockChapter initial state + sign-out reset. Avoid making all 16 consumers null-safe."
    status: completed
  - id: openlibrary-cleanup
    content: "P2 (Phase A4): Remove Open Library Gatsby chapter-stub hack; OL becomes metadata-only enrichment."
    status: completed
  - id: retire-mock-modules
    content: "P2 (Phase A5): Delete runtime mock modules (mockContentService, seededBooks/mockChapter exports); keep mockBook.json as pipeline-only artifact; rewrite affected tests with fixtures."
    status: completed
  - id: audio-generalize
    content: "P3 (Phase B1+B2): Remove chapterIndex===1 audio crutch + static offset map (audioSources, chapterAudio, chapterMediaOverrides -> DB audio_offset_ms). Keep bundledSyncAssets only as slug-keyed offline fallback."
    status: completed
  - id: sync-readiness
    content: "P3 (Phase B3): Ensure normalizeSyncAssetForRuntime/syncReady runs for Supabase chapters and surface syncReady=false in the reader UI (do NOT re-block audio on it)."
    status: completed
  - id: pipeline-manifest
    content: "P4 (Phase C1+C2, parallel track): Make chapterMediaManifest data-driven for all chapters of a book; build a real per-chapter LibriVox audio fetcher with npm script."
    status: in_progress
  - id: pipeline-batch
    content: "P4 (Phase C3, parallel track): Extend runChapterPipeline to batch extract/repair/validate across a whole book; document the per-chapter WhisperX Colab loop."
    status: pending
  - id: gatsby-full-align
    content: "P5 (Phase E1, content-ops): Align + seed Gatsby ch.2-9 (WhisperX -> repair -> validate -> seed) so all 9 chapters have real audio + sync in Supabase."
    status: pending
  - id: qa-generalize
    content: "P5 (Phase E2): Replace single-chapter verify script with a parameterized verifier; run full CI + manual QA across Gatsby ch.1-9 with Supabase-only data."
    status: pending
isProject: false
---

# Readr: Supabase-Only Reading + Audio Core

## Goal

Make Supabase the single source of truth for all reading/audio data, remove every mock/seed/fallback crutch, generalize the alignment pipeline to be data-driven, harden karaoke, and prove it on the full Gatsby book.

## Guiding principles

- Supabase is the ONLY runtime content source. `mockBook.json` survives ONLY as an offline pipeline ingest artifact (the seed + align scripts read it), never imported by `src/` runtime.
- Nothing keys off `chapterIndex === 1`. Audio/sync/offset come from DB rows + Storage for every chapter.
- One explicit, slug-keyed offline fallback (Gatsby ch.1 text+sync) is retained for resilience - this is NOT mock data and NOT an index check.
- Each step must keep `npm run ci` green and the app launchable (Gatsby still plays from Supabase) before moving on.
- Fix foundations before deleting: prove Supabase-only works great on ONE chapter before removing the known-good mock path.

## Stress-test findings baked into this revision

- REGRESSION TRAP: `[src/services/content/supabaseContent.ts](src/services/content/supabaseContent.ts)` only loads real WhisperX timings when `audioEnabled` is true (`applySyncTimings` is gated), and `audioEnabled` defaults false; the mock path applies sync unconditionally. Removing mock without fixing this makes karaoke WORSE. Fixed first in P0.
- CONNECTIVITY CLIFF: `[src/services/sync/textCache.ts](src/services/sync/textCache.ts)` has no bundled fallback and `downloadAsync` is not wrapped - first offline open throws. Hardened in P0; slug-keyed bundled ch.1 retained.
- BLAST RADIUS: 16 components consume `usePlayback`/`usePlaybackSession`. A3 uses a loading gate at `AppShell`/navigation instead of making every consumer null-safe.
- SEQUENCING: GPU alignment of ch.2-9 is decoupled into a parallel content-ops track (P4/P5) so the refactor is provable on ch.1 alone.

## Current data flow (to dismantle)

```mermaid
flowchart TB
  store["useContentStore default: mock-json if no Supabase"]
  repo["repository.fetchChapter"]
  store --> repo
  repo -->|mock-json| mock["mockContentService + mockBook.json"]
  repo -->|legacy-seed| seed["seededBooks paragraphs"]
  repo -->|supabase| supa["supabaseContent (text+sync+audio Storage)"]
  ctx["PlaybackContext initial state = mockBook/mockChapter"]
  ol["openLibraryService: injects Gatsby chapter stubs from mock"]
  audio["audioSources: chapterIndex===1 -> bundled demo mp3"]
  sync["bundledSyncAssets: only gatsby-ch-1 real, else synthetic"]
```

Target: every arrow except `supabase` is removed; `PlaybackContext` starts from a loading/empty session; one slug-keyed bundled fallback remains for offline.

## Execution order

```mermaid
flowchart TB
  P0["P0 Foundations: fix audioEnabled gating + harden offline + verify Supabase ch.1"]
  P1["P1 Karaoke reliability (Phase D), prove on ch.1"]
  P2["P2 Remove mock at runtime (Phase A) behind loading gate"]
  P3["P3 Generalize audio/sync crutches (Phase B)"]
  P4["P4 Pipeline data-driven (Phase C) - parallel content track"]
  P5["P5 Align+seed ch.2-9 + QA (Phase E)"]
  P0 --> P1 --> P2 --> P3 --> P5
  P4 --> P5
```

---

## P0 - Foundations (do FIRST, before any deletion)

### P0.1 Fix the sync-timing gating (karaoke regression guard)
- `[src/services/content/supabaseContent.ts](src/services/content/supabaseContent.ts)`: in `hydrateChapterFromSupabase`, load real sync timings whenever `dbChapter.sync_hash` exists - remove the `audioEnabled &&` condition from `applySyncTimings`. `audioEnabled` should gate only audio playback, not whether karaoke timings are present.

### P0.2 Harden offline + keep slug-keyed bundled fallback
- `[src/services/sync/textCache.ts](src/services/sync/textCache.ts)`: wrap `downloadAsync` in try/catch; on failure fall back to the cached file if present, else a bundled text asset (Gatsby ch.1). Mirror the existing pattern in `[src/services/sync/cache.ts](src/services/sync/cache.ts)`.
- `[src/data/bundledSyncAssets.ts](src/data/bundledSyncAssets.ts)`: keep `the-great-gatsby-ch-1` bundled sync as an explicit, slug-keyed offline fallback (used by cache fallback), decoupled from any index check.

### P0.3 Verify Supabase ch.1 end-to-end
- Confirm Supabase has Gatsby book + ch.1 row + `text/`, `sync/`, `audio/` Storage objects. With mock paths force-disabled, confirm ch.1 plays audio AND shows real (not synthetic) karaoke. This is the go/no-go gate for P2.

---

## P1 - Karaoke + sync reliability (Phase D, isolated, prove on ch.1)

### D1. FlashList correctness
- `[src/components/ReaderView.tsx](src/components/ReaderView.tsx)`: differentiate `getItemType` for static vs active-karaoke rows (or disable recycling for the active index) to stop cell-reuse glitches; actually USE `visibleIndicesRef` to skip redundant `scrollToIndex`; verify measured heights for tall karaoke rows.

### D2. Stabilize row swap + clock lag
- `[src/components/read/ParagraphRow.tsx](src/components/read/ParagraphRow.tsx)`: smooth the `StaticParagraphRow` <-> `ActiveKaraokeParagraphRow` remount (stable keys/heights). Reduce span/word index lag by driving it from `progressMs` faster on the active row instead of the 100 ms `useCoarseSyncTime`.
- `[src/context/PlaybackContext.tsx](src/context/PlaybackContext.tsx)`: apply `playbackRate` in the `useFallbackClock` tick (currently fixed 16 ms step).

---

## P2 - Supabase as single source of truth (Phase A, remove mock at runtime)

### A1. Collapse content sources
- `[src/store/useContentStore.ts](src/store/useContentStore.ts)`: remove `mock-json` and `legacy-seed` from `TextSource`; `textSource` is always `supabase`. Drop `defaultTextSource()` mock branch. Decide catalog: Supabase books as primary, Open Library as optional metadata enrichment only.
- `[src/screens/ProfileScreen.tsx](src/screens/ProfileScreen.tsx)`: remove the `__DEV__` text-source/catalog toggles and `getMockBookMetadata()` display.

### A2. Repoint the repository
- `[src/services/content/repository.ts](src/services/content/repository.ts)`: `fetchChapter` -> Supabase only (throw `ChapterNotFoundError` if missing, no seed/mock branch). `fetchCatalog`/`fetchBooks` -> Supabase (`fetchBooksFromSupabase`, wire in unused `fetchCatalogFromSupabase`). `canReadBook`/`refreshReadableBookSlugs` -> `fetchReadableBookSlugsFromSupabase`. Remove `seededBooks`, `fetchChapterFromSeed`, `hydrateChapterFromSeed`, `mapCatalogFromSeed`, `LEGACY_BOOK_SLUGS`.

### A3. Remove mock initial state from playback (via loading gate)
- Add a loading gate at `AppShell`/navigation (and `[src/hooks/useReadSession.ts](src/hooks/useReadSession.ts)`) so reading screens mount only once a real `book`/`chapter` is loaded - this keeps the ~16 `usePlayback` consumers non-null without auditing each.
- `[src/context/PlaybackContext.tsx](src/context/PlaybackContext.tsx)`: replace `mockBook`/`mockChapter` initial React state with a loading/empty session (`book`/`chapter` nullable + `isLoadingChapter`). Update `stopSessionForSignOut` to reset to empty instead of `mockChapter`.

### A4. Open Library cleanup
- `[src/services/openLibrary/openLibraryService.ts](src/services/openLibrary/openLibraryService.ts)`: remove the Gatsby chapter-stub injection via `getMockChapterStubs()`. OL returns catalog metadata only; chapter lists come from Supabase.

### A5. Retire mock modules + fix tests
- Delete runtime mock consumers: `[src/services/content/mockContentService.ts](src/services/content/mockContentService.ts)`, and the `seededBooks`/`mockBook`/`mockChapter` exports in `[src/data/mockChapter.ts](src/data/mockChapter.ts)` (keep only what scripts need, or move to `scripts/`).
- Keep `[src/mocks/mockBook.json](src/mocks/mockBook.json)` as a pipeline-only artifact (seed + align read it). Confirm no `src/` import remains.
- Update `[src/tests/syncEngine.test.ts](src/tests/syncEngine.test.ts)` and `[src/tests/bookmarkFlow.test.ts](src/tests/bookmarkFlow.test.ts)` to build local fixtures instead of importing `mockChapter`/`seededBooks`.

---

## P3 - Generalize audio + sync runtime (Phase B, kill ch.1 crutches)

### B1. Audio resolution is DB-driven
- `[src/services/content/audioSources.ts](src/services/content/audioSources.ts)`: remove the `chapterIndex === 1` bundled-demo branch. Resolve from Supabase Storage via `audioPath` for all chapters. Any offline bundle is a single explicit slug-keyed map, not an index check.
- `[src/utils/chapterAudio.ts](src/utils/chapterAudio.ts)`: `chapterHasPlayableAudio` returns based on `chapter.audioPath` presence, not `chapterIndex === 1`.

### B2. Offset from DB, bundle only as offline fallback
- `[src/data/chapterMediaOverrides.ts](src/data/chapterMediaOverrides.ts)`: remove the static slug->offset map and the `resolveAudioOffsetMs` call sites in `[src/services/content/supabaseContent.ts](src/services/content/supabaseContent.ts)` (lines using it in `mapDbChapter`/`applySyncTimings`). Use `row.audio_offset_ms` directly. If corrections are needed, store them in a DB column, not a TS map.
- `[src/data/bundledSyncAssets.ts](src/data/bundledSyncAssets.ts)`: retains ONLY the slug-keyed Gatsby ch.1 offline fallback from P0.2 (no synthetic generation for other chapters at runtime).

### B3. Trust + surface sync readiness
- Ensure `normalizeSyncAssetForRuntime` / `syncReady` in `[src/utils/syncAsset.ts](src/utils/syncAsset.ts)` is applied for Supabase-loaded chapters, and surface `syncReady === false` in the reader (currently karaoke just silently disables in `[src/components/ReaderView.tsx](src/components/ReaderView.tsx)`). Do NOT re-block audio on it.

---

## P4 - Make the alignment pipeline data-driven (Phase C, parallel content track)

### C1. Manifest from data
- `[scripts/alignment/chapterMediaManifest.ts](scripts/alignment/chapterMediaManifest.ts)`: generate entries for ALL chapters of a book (derive paths from `{bookSlug}` + `chapterIndex`) instead of one hand-edited row. Drive from `mockBook.json` chapter list (or a small books manifest).

### C2. Real LibriVox per-chapter audio fetcher
- Flesh out `[scripts/ingest/librivox.ts](scripts/ingest/librivox.ts)` (currently scaffold) into a downloader that pulls each Gatsby chapter MP3 to `assets/audio/{book}/ch-{n}.mp3`. Add an npm script.

### C3. Batch align/repair/validate
- Extend `[scripts/alignment/runChapterPipeline.ts](scripts/alignment/runChapterPipeline.ts)` to iterate a whole book's chapters: `align:extract` -> (WhisperX Colab per chapter, manual GPU) -> `repair:sync` -> `validate:sync`. Document the Colab loop in `scripts/alignment/whisperx/COLAB.md`.

---

## P5 - Prove on full Gatsby + QA (Phase E, content-ops)

### E1. Align + seed all 9 chapters
- Run Phase C pipeline for Gatsby ch.2-9, commit sync JSON, `npm run seed:supabase` so DB + Storage hold text/sync/audio for every chapter.

### E2. Generalize verification
- Replace single-chapter `[scripts/verify/readViewGatsbyCh1.ts](scripts/verify/readViewGatsbyCh1.ts)` with a parameterized verifier (any book/chapter): block counts, sentence spans, row-height sanity, `syncReady`.
- `npm run ci` green; manual QA: open Gatsby chapters 1-9, confirm audio + karaoke + follow-scroll + sentence seek with NO mock data and Supabase as the only source.

---

## Risks / notes

- BIGGEST RISK (now mitigated): the `audioEnabled` gating on `applySyncTimings` would have regressed karaoke when mock was removed. P0.1 fixes it before any deletion.
- A3 (removing mock initial state) is the riskiest deletion - mitigated with a loading gate at `AppShell`/navigation rather than null-checking 16 consumers.
- Connectivity: first online load caches text+sync to FileSystem; a slug-keyed bundled Gatsby ch.1 keeps the app demoable fully offline. Do not go network-only.
- "Full Gatsby with real audio" depends on GPU WhisperX runs (Colab) per chapter - decoupled into P4/P5 content-ops so it never blocks the P0-P3 refactor.
- Do NOT re-block audio on `syncReady` (regression from a prior session); surface it in UI instead.
- Keep each phase shippable: after P0-P3 the app must play Gatsby ch.1 purely from Supabase (with real karaoke) before aligning the rest.

## Definition of done per milestone

- P0 done: Supabase ch.1 shows REAL karaoke with `audioEnabled` independent of timings; offline open does not throw.
- P1 done: karaoke smooth through long blocks on ch.1, follow-scroll/seek reliable, no recycling glitches.
- P2-P3 done: zero `src/` imports of mock/seed modules; app runs Supabase-only; one slug-keyed offline fallback remains; `npm run ci` green.
- P5 done: Gatsby ch.1-9 all play with real audio + karaoke from Supabase.