# Readr — Architecture Source of Truth

Engineering reference for the Readr codebase. Describes what exists, how data moves, and where the brittle parts are. For setup commands see [README.md](README.md).

---

## 1. System Overview & Tech Stack

### Core purpose

Readr is a **bimodal reading application**: chapter text displayed in a scrollable reader, optionally synchronized with spoken audio (LibriVox) at **word-level granularity** (karaoke-style highlight). Additional capabilities:

- Cloud bookmarks (sentence-scoped highlights)
- Sentence-context Ask AI (OpenAI via Supabase Edge Function)
- Open Library–sourced catalog metadata with locally seeded readable text

**Production MVP target:** *The Great Gatsby* chapter 1 with real WhisperX word alignment (~5,888 words, 152 sentences). Other books/chapters in the seed catalog use synthetic word timings or empty stubs until aligned.

### Languages and runtimes

| Layer | Technology |
|-------|------------|
| Mobile client | TypeScript, React 19.0.0, React Native 0.79.6, Expo SDK ~53.0.0 |
| Offline tooling | TypeScript via `tsx`, Python 3 (WhisperX alignment — not bundled in app) |
| Backend | PostgreSQL, Supabase Auth, Supabase Storage, Deno Edge Functions |
| CI | Node 20, GitHub Actions |

### Critical third-party dependencies

From [package.json](package.json):

| Category | Package | Version (approx.) |
|----------|---------|-------------------|
| Navigation | `@react-navigation/native`, `native-stack`, `bottom-tabs` | ^7.x |
| Backend SDK | `@supabase/supabase-js` | ^2.106.2 |
| State | `zustand` | ^5.0.14 |
| Audio | `expo-av` | ~15.1.7 |
| Animation | `react-native-reanimated` | ~3.17.4 |
| Persistence | `@react-native-async-storage/async-storage`, `expo-file-system`, `expo-secure-store` | Expo 53–aligned |
| Auth helpers | `expo-auth-session`, `expo-linking`, `expo-web-browser` | Expo 53–aligned |
| Testing | `vitest` | ^4.1.8 |

**Explicitly not used:** Expo Router, Redux, TanStack Query, MobX, a custom REST API server in-repo.

### External APIs and services

| Service | Role | Where configured |
|---------|------|------------------|
| Supabase | Auth (email OTP), Postgres, Storage, Edge Functions | [src/config/env.ts](src/config/env.ts), [src/services/supabase/client.ts](src/services/supabase/client.ts) |
| Open Library REST | Catalog metadata (title, author, cover, description) | [src/services/openLibrary/openLibraryService.ts](src/services/openLibrary/openLibraryService.ts) |
| OpenAI | Ask AI completions (`gpt-4.1-mini`) | [supabase/functions/ask-ai/index.ts](supabase/functions/ask-ai/index.ts) |
| WhisperX | Offline forced alignment (Colab/local GPU) | [scripts/alignment/whisperx/align_chapter.py](scripts/alignment/whisperx/align_chapter.py) |

### Application bootstrap

```
expo/AppEntry.js  →  App.tsx  →  providers  →  AppShell  →  NavigationContainer
```

There is **no** root `index.tsx`. Expo's entry loads [App.tsx](App.tsx), which mounts:

```tsx
SafeAreaProvider
  → AuthProvider
    → ProgressProvider          // Reanimated SharedValue for playback position
      → PlaybackProvider        // Session, catalog, chapter, audio, bookmarks, AI
        → AppShell              // Auth gate → RootNavigator | AuthScreen
```

---

## 2. Project Architecture & Directory Structure

### Architectural pattern

**Layered monolith client** + **Supabase BaaS** + **offline content pipeline**.

This is not MVC, Clean Architecture, or microservices. The closest label: **feature-oriented layers** with:

- A **facade repository** ([src/services/content/repository.ts](src/services/content/repository.ts)) for all book/chapter I/O
- A **god-context** ([src/context/PlaybackContext.tsx](src/context/PlaybackContext.tsx)) for playback session orchestration
- **Pure utils** for sync math and chapter transformation

```mermaid
flowchart TB
  subgraph client [ExpoClient]
    Screens --> Hooks
    Hooks --> Context
    Context --> Services
    Services --> Utils
    Services --> SupabaseSDK
  end
  subgraph offline [OfflinePipeline]
    Scripts --> AssetsJSON
    Scripts --> SupabaseSeed
  end
  subgraph backend [Supabase]
    Postgres --> Storage
    EdgeFn[ask_ai EdgeFunction]
  end
  SupabaseSeed --> Storage
  SupabaseSDK --> Postgres
  SupabaseSDK --> Storage
  AssetsJSON --> client
```

### Directory map

| Path | Responsibility |
|------|----------------|
| [App.tsx](App.tsx) | Root provider tree and auth shell |
| [src/screens/](src/screens/) | Route-level screens (Home, Explore, Library, Read, Auth, Profile, etc.) |
| [src/navigation/](src/navigation/) | React Navigation v7: root stack + five-tab main navigator |
| [src/components/](src/components/) | Reusable UI; [ReaderView.tsx](src/components/ReaderView.tsx) and [KaraokeWord.tsx](src/components/KaraokeWord.tsx) are sync-critical |
| [src/context/](src/context/) | [AuthContext.tsx](src/context/AuthContext.tsx), [PlaybackContext.tsx](src/context/PlaybackContext.tsx) (~700 lines) |
| [src/store/](src/store/) | Zustand stores + [ProgressProvider.tsx](src/store/ProgressProvider.tsx) |
| [src/services/](src/services/) | I/O boundaries: content, auth, audio, bookmarks, AI, Supabase client |
| [src/hooks/](src/hooks/) | Composition: `useOpenBook`, `useReadSession`, `useSyncEngine`, `useCoarseSyncTime` |
| [src/utils/](src/utils/) | Pure logic: sync engine, sync asset transform, chapter builder, karaoke math |
| [src/types/](src/types/) | Shared TypeScript contracts |
| [src/mocks/mockBook.json](src/mocks/mockBook.json) | Full Gatsby ch.1 text (152 paragraphs); source for mock-json, seed, and align extract |
| [src/data/](src/data/) | Static config: theme, book covers, [chapterMediaOverrides.ts](src/data/chapterMediaOverrides.ts) |
| [assets/sync/](assets/sync/) | Committed WhisperX output (Gatsby ch.1: ~535 KB JSON, ~5,888 words) |
| [assets/align/](assets/align/) | Alignment pipeline sentence input |
| [assets/audio/](assets/audio/) | LibriVox MP3 (gitignored); demo MP3 may be bundled |
| [scripts/](scripts/) | Ingest, alignment, validation, Supabase seed — **never imported by the app** |
| [supabase/migrations/](supabase/migrations/) | Postgres schema, RLS, storage buckets |
| [supabase/functions/](supabase/functions/) | Deno edge functions |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | CI: typecheck, lint, test |

### Navigation structure

**Root stack** ([src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx)):

- `MainTabs` — bottom tab navigator
- `Read` — full-screen modal (`bookSlug`, optional `chapterSlug`)
- `ReadUnavailable` — book not yet seeded/readable

**Bottom tabs** ([src/navigation/MainTabs.tsx](src/navigation/MainTabs.tsx)): Home, Explore, Library, Community, Profile.

Route param types: [src/navigation/types.ts](src/navigation/types.ts).

---

## 3. Core Data Flow & State Management

### Primary lifecycle: open book → read with karaoke

There are **two different functions named `openBook`** — a common source of confusion:

| Function | File | Does |
|----------|------|------|
| Navigation gate | [src/hooks/useOpenBook.ts](src/hooks/useOpenBook.ts) | Checks `canReadBook`, navigates to `Read` or `ReadUnavailable` |
| Content load | [src/context/PlaybackContext.tsx](src/context/PlaybackContext.tsx) `openBook` | Fetches chapter, hydrates sync, loads audio, updates session state |

```mermaid
sequenceDiagram
  participant User
  participant useOpenBook
  participant ReadScreen
  participant useReadSession
  participant PlaybackCtx as PlaybackContext
  participant Repo as repository.fetchChapter
  participant SB as supabaseContent
  participant Sync as syncAssetToChapter
  participant Player as chapterPlayer
  participant ReaderView

  User->>useOpenBook: tap book card
  useOpenBook->>useOpenBook: canReadBook slug
  useOpenBook->>ReadScreen: navigate Read
  ReadScreen->>useReadSession: mount
  useReadSession->>PlaybackCtx: openBook
  PlaybackCtx->>Repo: fetchChapter
  Repo->>SB: hydrate text plus sync from Storage
  SB->>Sync: repair plus expand word timestamps
  Repo-->>PlaybackCtx: book and chapter
  PlaybackCtx->>Player: load audio if audioEnabled
  PlaybackCtx-->>ReaderView: chapter state
  Player-->>PlaybackCtx: onVisualPosition every 50ms
  PlaybackCtx-->>ReaderView: progressMs SharedValue
  ReaderView->>ReaderView: useSyncEngine active sentence
```

### Content source routing

Controlled by [src/store/useContentStore.ts](src/store/useContentStore.ts) — three independent settings persisted to AsyncStorage under `readr.content.sources`:

| Setting | Default | Effect |
|---------|---------|--------|
| `catalogSource` | `openlibrary` | Book list metadata from Open Library API |
| `textSource` | `supabase` if env configured, else `mock-json` | Where chapter text and sync hydration run |
| `audioEnabled` | `false` | Whether sync timings overlay and audio player load |

**Facade:** [src/services/content/repository.ts](src/services/content/repository.ts) routes `fetchChapter` by `textSource`:

| `textSource` | Loader | Notes |
|--------------|--------|-------|
| `mock-json` | [mockContentService.ts](src/services/content/mockContentService.ts) | [mockBook.json](src/mocks/mockBook.json) only |
| `supabase` | [supabaseContent.ts](src/services/content/supabaseContent.ts) | Storage JSON + optional sync overlay |
| `legacy-seed` | [mockChapter.ts](src/data/mockChapter.ts) `seededBooks` | Bundled inline paragraphs |

In-memory chapter cache keyed by `textSource:bookSlug:chapterSlug`.

### Supabase chapter hydration

[src/services/content/supabaseContent.ts](src/services/content/supabaseContent.ts) `hydrateChapterFromSupabase`:

1. **Text (required):** Download `text/{book}/ch-{n}.json` from Storage → [textCache.ts](src/services/sync/textCache.ts) → [textAssetToChapter](src/utils/textAsset.ts) (synthetic placeholder word times)
2. **Sync (conditional):** If `audioEnabled && sync_hash`, download `sync/{book}/ch-{n}.json` → [cache.ts](src/services/sync/cache.ts) → [syncAssetToChapter](src/utils/syncAsset.ts) (replaces word timings with WhisperX data)
3. **Offset override:** [resolveAudioOffsetMs](src/data/chapterMediaOverrides.ts) applied client-side without re-seed

Open Library ([openLibraryService.ts](src/services/openLibrary/openLibraryService.ts)) supplies catalog metadata only. It does **not** provide chapter text. Books without seeded text show [ReadUnavailableScreen](src/screens/ReadUnavailableScreen.tsx).

### Sync asset pipeline (runtime)

Every call to `syncAssetToChapter` in [src/utils/syncAsset.ts](src/utils/syncAsset.ts):

1. Runs [repairSyncAsset](src/utils/syncTimelineRepair.ts) (timeline gap + monotonic timing fixes)
2. Detects legacy file-audio coordinates via `usesLegacyAudioWordTimings()`
3. Expands minified JSON `{ w, s, e }` into runtime `Chapter` with `Sentence[]` and `WordTimestamp[]`
4. Sets `audioOffsetMs`, `durationMs`, `syncHash`

**WhisperX failure mode:** Sentence 0 aligned to LibriVox disclaimer (~0–5 s visual) while sentence 1+ remain in file-audio coordinates (~27 s+). `repairTimelineGap` re-anchors sentence 1+ to visual time and sets `audio_offset_ms` to ~22 s (anchor minus 250 ms pre-roll). Same repair runs at build time (`npm run repair:sync`) and at runtime.

Current Gatsby ch.1 committed sync: `audio_offset_ms: 22287` in [assets/sync/the-great-gatsby/ch-1.json](assets/sync/the-great-gatsby/ch-1.json).

### Audio coordinate systems

| Timeline | Meaning | Used by |
|----------|---------|---------|
| **Visual** | Word `start_ms` / `end_ms` in chapter state; 0 = narration start | Karaoke, seek, progress bar |
| **File** | Raw MP3 position in milliseconds | Expo AV `positionMillis` |
| **`audio_offset_ms`** | File seek point before first spoken word (includes 250 ms pre-roll) | Player load/play |

Conversion in [src/utils/syncAsset.ts](src/utils/syncAsset.ts):

```typescript
audioToVisualMs(audioMs, offset)  // visual = max(0, audioMs - offset)
visualToAudioMs(visualMs, offset) // audio = visualMs + offset
```

[src/services/audio/chapterPlayer.ts](src/services/audio/chapterPlayer.ts):

- On `load`: file stays at 0; reports visual position 0
- On first `play()`: seeks to `audio_offset_ms` if position is before offset (skips LibriVox intro)
- Progress callbacks every 50 ms → `onVisualPosition` → updates Reanimated `progressMs`

### State management layers

Do not conflate these — they exist to separate re-render frequency from UI-thread animation:

| Layer | Mechanism | Holds | Update rate |
|-------|-----------|-------|-------------|
| [useContentStore](src/store/useContentStore.ts) | Zustand | Source prefs, readable book slugs | Rare |
| [usePlaybackStore](src/store/usePlaybackStore.ts) | Zustand | `isPlaying`, `isImmersive`, loading flags, scroll targets, playback rate | User actions |
| [ProgressProvider](src/store/ProgressProvider.tsx) | Reanimated `SharedValue` | `progressMs` | ~50 ms from audio; read on UI thread by KaraokeWord |
| [PlaybackContext](src/context/PlaybackContext.tsx) | React Context | `book`, `chapter`, `wordIndex`, bookmarks, AI sheet | On chapter/load actions |
| `SyncTimeContext` (same file) | React Context | `syncTimeMs` only | 50 ms interval for sentence-level React consumers |

**PlaybackContext split:** `usePlaybackSession()` excludes `syncTimeMs` so Listen UI avoids ~20 Hz re-renders. `usePlayback()` merges session + `syncTimeMs`. Karaoke word fill uses `progressMs` SharedValue directly — not React state.

**Sync lookup:** [buildWordIndex](src/utils/syncAsset.ts) flattens all words on chapter change. [findActiveWord](src/utils/syncEngine.ts) binary-searches the flat index — O(log n), adequate for ~10k words.

### Startup (before any book open)

On mount, [PlaybackProvider](src/context/PlaybackContext.tsx):

1. `useContentStore.hydrate()` — load persisted source preferences
2. `refreshCatalog()` → `reloadCatalog()` → refresh readable slugs + fetch catalog + fetch books
3. If authenticated, load bookmarks from Supabase

---

## 4. Critical Connections & Dependencies

### Hotspots

Files with highest fan-in or complexity — change these with care:

| File | Why it is hot |
|------|---------------|
| [src/context/PlaybackContext.tsx](src/context/PlaybackContext.tsx) | Catalog, chapter load, audio, bookmarks, AI, sync clock; large memoized context value |
| [src/services/content/repository.ts](src/services/content/repository.ts) | All content paths converge here |
| [src/utils/syncAsset.ts](src/utils/syncAsset.ts) + [syncTimelineRepair.ts](src/utils/syncTimelineRepair.ts) | Sync JSON ↔ runtime chapter; intro gap repair |
| [src/components/ReaderView.tsx](src/components/ReaderView.tsx) | Renders entire chapter; karaoke scoped to active sentence |
| [src/mocks/mockBook.json](src/mocks/mockBook.json) | Source of truth for Gatsby text in mock, seed, and align extract |

### Internal module boundaries

These are not HTTP APIs — they are TypeScript module contracts:

| Export | Defined in | Consumers | Contract |
|--------|------------|-----------|----------|
| `fetchChapter(bookSlug, chapterSlug)` | [repository.ts](src/services/content/repository.ts) | PlaybackContext | `{ book, chapter }` with populated `chapter.sentences[].words[]` |
| `syncAssetToChapter(asset, meta)` | [syncAsset.ts](src/utils/syncAsset.ts) | repository, supabaseContent, mockContentService | `Chapter` with visual word times |
| `buildWordIndex(chapter)` | [syncAsset.ts](src/utils/syncAsset.ts) | PlaybackContext | Flat sorted `IndexedWord[]` |
| `findActiveWord(index, timeMs)` | [syncEngine.ts](src/utils/syncEngine.ts) | [useSyncEngine.ts](src/hooks/useSyncEngine.ts) | Active sentence/word from coarse clock |
| `chapterAudioPlayer.load/play/seekVisualMs` | [chapterPlayer.ts](src/services/audio/chapterPlayer.ts) | PlaybackContext | Callback-driven visual position |
| `loadChapterSyncAsset` / `loadChapterTextAsset` | [cache.ts](src/services/sync/cache.ts), [textCache.ts](src/services/sync/textCache.ts) | Content services | Hash-versioned filesystem cache |
| `apiRequest('/v1/ask-ai')` | [api/client.ts](src/services/api/client.ts) | [askAi.ts](src/services/ai/askAi.ts) | Proxies to Supabase edge function URL |

**No in-repo REST server.** [EXPO_PUBLIC_API_BASE_URL](src/config/env.ts) routes Ask AI to the edge function when set; all other backend I/O uses `@supabase/supabase-js` directly.

### Offline alignment pipeline (build-time only)

```
mockBook.json
  → npm run align:extract     → assets/align/.../sentences.json
  → WhisperX align_chapter.py → assets/sync/.../ch-1.json
  → npm run repair:sync       → gap + monotonic fix on disk
  → npm run validate:sync     → schema + text parity gate
  → npm run seed:supabase     → Storage upload + DB upsert
```

See [scripts/alignment/whisperx/COLAB.md](scripts/alignment/whisperx/COLAB.md) for GPU alignment steps.

Chapter media registry: [scripts/alignment/chapterMediaManifest.ts](scripts/alignment/chapterMediaManifest.ts) (currently Gatsby ch.1).

---

## 5. Authentication, Authorization & Security

### Client-side auth gate

There is **no server middleware** in this repo. The Expo app gates access in [App.tsx](App.tsx):

```
AuthProvider hydrates session
  → if !isHydrated: spinner
  → if !isSignedIn: AuthScreen
  → else: RootNavigator
```

### Auth implementation files

| File | Role |
|------|------|
| [src/context/AuthContext.tsx](src/context/AuthContext.tsx) | Session state, OTP flow, dev guest, deep-link handler |
| [src/services/auth/session.ts](src/services/auth/session.ts) | `signInWithOtp`, `verifyOtp`, `signOut`, dev guest user |
| [src/services/auth/authCallback.ts](src/services/auth/authCallback.ts) | Magic-link token exchange via `setSession` |
| [src/services/auth/redirect.ts](src/services/auth/redirect.ts) | `readr://auth/callback` redirect URI |
| [src/services/supabase/client.ts](src/services/supabase/client.ts) | Singleton Supabase client; AsyncStorage session; `detectSessionInUrl: false` |
| [src/config/env.ts](src/config/env.ts) | `canUseDevGuestBypass()` = `!hasSupabaseConfig() \|\| __DEV__` |

**Auth method:** Email OTP (magic link support exists but primary flow is OTP per [AuthScreen](src/screens/AuthScreen.tsx)).

**Dev guest:** Synthetic user ID `dev-local-user`. Bookmarks are local-only; no Supabase writes when guest ([bookmarks/repository.ts](src/services/bookmarks/repository.ts) checks `isDevGuestUserId`).

Setup documentation: [supabase/AUTH_SETUP.md](supabase/AUTH_SETUP.md).

### Server-side authorization (RLS)

Primary schema: [supabase/migrations/001_init_v2.sql](supabase/migrations/001_init_v2.sql).

| Table / resource | Policy |
|------------------|--------|
| `books`, `chapters`, `sentences` | Public SELECT |
| `user_highlights` | CRUD scoped to `auth.uid()` |
| `ai_threads`, `ai_messages` | CRUD scoped to `auth.uid()` |
| Storage buckets (`003_storage.sql`, `004_text_storage.sql`) | Public read on `audio`, `sync`, `text`, `covers` |

Text metadata columns added in [004_text_storage.sql](supabase/migrations/004_text_storage.sql): `text_metadata_path`, `text_hash`, `text_version` on `chapters`.

### Known security gaps

Document these when extending the system:

1. **Ask AI edge function** ([supabase/functions/ask-ai/index.ts](supabase/functions/ask-ai/index.ts)): No JWT/`auth.uid()` validation. Client sends `requireAuth: true` in [askAi.ts](src/services/ai/askAi.ts) but the edge function does not enforce it. CORS is `Access-Control-Allow-Origin: *`.
2. **Public storage buckets:** Anyone with the URL can fetch audio, sync, and text JSON assets.
3. **Dev guest in `__DEV__`:** Bypasses real auth even when Supabase is configured ([env.ts](src/config/env.ts)).
4. **Migration drift:** [002_content_alignment.sql](supabase/migrations/002_content_alignment.sql) references legacy `bookmarks` RLS; the app uses `user_highlights`.
5. **Service role key:** Only used in [scripts/seed/supabaseSeed.ts](scripts/seed/supabaseSeed.ts) and check scripts — must never ship in the app bundle.

---

## 6. The "Hidden Truth" (Tech Debt & Gotchas)

### Architectural debt

1. **Split-source confusion.** Open Library provides catalog metadata only. Readable text requires Supabase seed or `mock-json`. Open Library books without a matching seeded slug navigate to `ReadUnavailable`.

2. **Two `openBook` functions.** [useOpenBook](src/hooks/useOpenBook.ts) navigates; [PlaybackContext.openBook](src/context/PlaybackContext.tsx) loads content. Debugging "book won't open" vs "chapter won't load" requires knowing which one is failing.

3. **Relational `sentences` table vs runtime.** The app reads **Storage JSON** at runtime, not Postgres `sentences` rows. DB sentences are populated at seed time for FK/RLS integrity and potential future server use.

4. **WhisperX intro mis-map.** Sentence 0 frequently aligns to the LibriVox spoken disclaimer instead of chapter narration. Requires [repairTimelineGap](src/utils/syncTimelineRepair.ts) and `audio_offset_ms` ~22 s for Gatsby (not the raw WhisperX value of ~341 ms). Repair runs on every `syncAssetToChapter` call and via `npm run repair:sync`.

5. **Karaoke performance ceiling.** Gatsby ch.1 has ~5,888 words across 152 sentences. Mounting a [KaraokeWord](src/components/KaraokeWord.tsx) (dual `Text` layers + Reanimated `useAnimatedStyle`) per word **crashes the app**. Current mitigations in [ReaderView.tsx](src/components/ReaderView.tsx):
   - Karaoke renders **only on the active sentence**: `karaokeWords={karaokeEnabled && si === activeSentenceIndex}`
   - `isImmersive` is set on play/word-tap, not on audio load ([PlaybackContext.tsx](src/context/PlaybackContext.tsx) — `setImmersive(true)` only in `seekToWord`; play sets immersive via `usePlaybackStore` `setPlaying`)

6. **No list virtualization.** [ReaderView](src/components/ReaderView.tsx) uses `ScrollView` mapping all sentences. Layout cost scales linearly with chapter length. `ExploreScreen` uses `FlatList`; the reader does not.

7. **Weak sync cache hash.** [hashSyncAsset](src/utils/syncAsset.ts) uses a djb2-style string hash with an inline comment to replace with SHA-256. Collision risk is low at current scale but invalidation is not cryptographically sound.

8. **Legacy coordinate heuristic.** `usesLegacyAudioWordTimings()` returns true when `firstWord.s >= audio_offset_ms * 0.5`. Brittle if WhisperX output shape changes.

9. **CI gap.** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs `typecheck`, `lint`, `test` only. [package.json](package.json) `ci` script also runs `validate:mock-book` and `validate:sync` — those gates are **not** in GitHub Actions.

10. **Ask AI silent fallback.** If the edge function fails and `EXPO_PUBLIC_ASK_AI_FALLBACK` is not `false`, [askAi.ts](src/services/ai/askAi.ts) returns a hardcoded stub answer without surfacing the error.

11. **No TODO/FIXME in application source.** Technical debt is structural, not annotated in code.

12. **Python alignment outside npm test.** WhisperX output is validated manually via Colab + `npm run validate:sync`. No automated GPU CI.

### Anti-patterns in current code

| Issue | Location | Impact |
|-------|----------|--------|
| God context | PlaybackContext | Any session state change can invalidate large memo; many consumers re-render |
| ~20 Hz React sync clock | PlaybackContext `syncTimeMs` interval | Sentence highlighting re-renders despite karaoke using SharedValue |
| Deep clone in repair | `JSON.parse(JSON.stringify(asset))` in syncTimelineRepair | Allocates full sync asset on every chapter load |
| Optimistic sign-out | session.ts + AuthContext | Local state cleared before async Supabase signOut completes |
| Bundled synthetic sync fallback | getBundledSyncAsset returns chapterToSyncAsset(chapter) | Legacy-seed path never loads committed WhisperX JSON from assets/ |

### Scaling bottlenecks

| Resource | Current scale (Gatsby ch.1) | Limit |
|----------|----------------------------|-------|
| Words in chapter | ~5,888 | Active-sentence karaoke ~240 words max; full-chapter karaoke OOM/crash |
| Sync JSON size | ~535 KB / ~30k lines | Parsed entirely into memory; duplicated on repair clone |
| Sentences in ScrollView | 152 | All mounted; no windowing |
| wordIndex array | 5,888 entries | Rebuilt on every chapter object change |
| Storage cache | Per-chapter filesystem JSON | No LRU eviction; grows with chapters opened |

---

## 7. Entry Points & Onboarding

### Local development quickstart

```bash
cp .env.example .env          # optional: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run start
```

Enable karaoke in the app: Profile screen → toggle **audioEnabled** on.

Full aligned chapter pipeline:

```bash
npm run fetch:gatsby-audio     # LibriVox MP3 → assets/audio/ (gitignored)
npm run align:extract          # mockBook.json → assets/align/.../sentences.json
# GPU: run align_chapter.py per scripts/alignment/whisperx/COLAB.md
npm run repair:sync
npm run validate:sync
npm run seed:supabase          # requires SUPABASE_SERVICE_ROLE_KEY
npx expo start -c
```

Verification:

```bash
npm run typecheck && npm run lint && npm run test
npm run ci                     # adds validate:mock-book + validate:sync
npm run supabase:check         # DB + storage sanity
```

### "I need to change X — start here"

| Goal | Start here |
|------|------------|
| Book catalog / Explore list | [openLibraryService.ts](src/services/openLibrary/openLibraryService.ts), [ExploreScreen.tsx](src/screens/ExploreScreen.tsx) |
| Which books are readable | [repository.ts](src/services/content/repository.ts) `canReadBook`, [useContentStore.ts](src/store/useContentStore.ts), Profile toggles |
| Chapter text loading | [supabaseContent.ts](src/services/content/supabaseContent.ts), [mockContentService.ts](src/services/content/mockContentService.ts) |
| Karaoke / word highlight | [ReaderView.tsx](src/components/ReaderView.tsx), [KaraokeWord.tsx](src/components/KaraokeWord.tsx), [karaoke.ts](src/utils/karaoke.ts) |
| Audio sync / seek / intro skip | [chapterPlayer.ts](src/services/audio/chapterPlayer.ts), [PlaybackContext.tsx](src/context/PlaybackContext.tsx) |
| Sync JSON format / repair | [syncAsset.ts](src/utils/syncAsset.ts), [syncTimelineRepair.ts](src/utils/syncTimelineRepair.ts), [scripts/alignment/](scripts/alignment/) |
| New WhisperX-aligned chapter | [COLAB.md](scripts/alignment/whisperx/COLAB.md) → `repair:sync` → `validate:sync` → [supabaseSeed.ts](scripts/seed/supabaseSeed.ts) |
| Seed Supabase | [scripts/seed/supabaseSeed.ts](scripts/seed/supabaseSeed.ts) |
| Auth / login | [AuthContext.tsx](src/context/AuthContext.tsx), [AuthScreen.tsx](src/screens/AuthScreen.tsx), [AUTH_SETUP.md](supabase/AUTH_SETUP.md) |
| Bookmarks | [bookmarks/repository.ts](src/services/bookmarks/repository.ts), [BookmarksPanel.tsx](src/components/BookmarksPanel.tsx) |
| Ask AI | [PlaybackContext.tsx](src/context/PlaybackContext.tsx) `submitAskAi`, [askAi.ts](src/services/ai/askAi.ts), [ask-ai/index.ts](supabase/functions/ask-ai/index.ts) |
| Navigation / new screen | [RootNavigator.tsx](src/navigation/RootNavigator.tsx), [types.ts](src/navigation/types.ts) |
| Env / backend config | [.env.example](.env.example), [env.ts](src/config/env.ts) |
| Runtime audio offset tuning | [chapterMediaOverrides.ts](src/data/chapterMediaOverrides.ts) (no re-seed required) |
| Database schema | [supabase/migrations/001_init_v2.sql](supabase/migrations/001_init_v2.sql) |
| Ingest Gatsby EPUB/text | [scripts/ingest/runGatsby.ts](scripts/ingest/runGatsby.ts), [standardEbooks.ts](scripts/ingest/standardEbooks.ts) |

### Test coverage map

Vitest config: [vitest.config.ts](vitest.config.ts) — Node environment, [src/tests/](src/tests/) only.

| Test file | Covers |
|-----------|--------|
| syncEngine.test.ts | `findActiveWord` binary search |
| syncAsset.test.ts | Legacy vs visual timing normalization |
| syncTimelineRepair.test.ts | WhisperX gap repair + intro offset |
| validateSyncAsset.test.ts | Validation rule helpers |
| emailOtp.test.ts | OTP input validation |
| bookmarkFlow.test.ts | Bookmark grouping utils |

**Not covered:** AuthContext, PlaybackContext, ReaderView, KaraokeWord, chapterPlayer, Supabase I/O, component/E2E tests.

### Related documentation

| Document | Contents |
|----------|----------|
| [README.md](README.md) | Setup, env vars, high-level file index |
| [supabase/AUTH_SETUP.md](supabase/AUTH_SETUP.md) | OTP templates, SMTP, redirect URLs |
| [scripts/alignment/whisperx/COLAB.md](scripts/alignment/whisperx/COLAB.md) | GPU alignment operator workflow |
| [scripts/alignment/whisperx/README.md](scripts/alignment/whisperx/README.md) | Alignment script parameters |
| [assets/audio/README.md](assets/audio/README.md) | Local audio placement, LibriVox intro note |
| [.cursor/plans/whisperx_offset_pipeline_41a7bedb.plan.md](.cursor/plans/whisperx_offset_pipeline_41a7bedb.plan.md) | Original offset pipeline design (historical) |

---

*Last aligned with codebase state including: Gatsby ch.1 sync repair (`audio_offset_ms: 22287`), active-sentence-only karaoke, immersive-on-play behavior.*

---

## 8. Important Rules for AI Agents
1. **Never Break the Virtualization**: Do not alter `FlashList` properties in `ReaderView.tsx` that would force a full re-render of the text list.
2. **Absolute Y-Coordinates**: When calculating layout coordinates in `ReaderView.tsx` (e.g. for drag handles or autoscroll), always remember to include the paragraph margin (`theme.spacing.lg`) in the height accumulator loops. The `ParagraphRow` layout height does *not* include this margin!
3. **Context Boundaries**: State has been cleanly separated (Playback, AI, Bookmark, Catalog). If a new feature doesn't strictly need audio playback state, do NOT put it in `PlaybackContext`. Use the appropriate domain context or create a new one.
