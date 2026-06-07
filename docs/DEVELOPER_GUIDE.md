# Developer Guide & Maintenance

This document provides instructions on how to maintain, test, and safely extend the entire Readr codebase. It acts as the "Operations Manual" for any developer or AI agent working on the project.

## 🛠️ Code Quality & Maintenance
To keep the codebase healthy, run these commands frequently:
- **`npm run typecheck`**: Runs the TypeScript compiler to catch type errors without emitting files. This is mandatory before committing.
- **`npm run lint`**: Runs ESLint to enforce code style. Use `npm run lint -- --fix` to auto-fix minor issues.

## 📦 Adding New Features
When extending the codebase, follow these structural rules:

### 1. State Management
- Do **not** shove all state into a global store or a single massive Context.
- If a feature is isolated (e.g., Bookmarks, Dictionary, AI), create a dedicated Context in `src/context/` or a custom hook in `src/hooks/`.
- Use Zustand (`src/store/`) *only* for state that absolutely must be accessed outside of the React tree (e.g., background audio playback services).

### 2. UI & Styling
- Never use hardcoded hex colors or arbitrary pixel values for padding/margins.
- Always import `theme` from `src/constants/theme.ts`.
- Example: Use `theme.spacing.md` instead of `16`, and `theme.colors.surface` instead of `#FFFFFF`.

### 3. Adding New Screens
- Place the screen component in `src/screens/`.
- Update the navigation types in `src/navigation/types.ts`.
- Register the screen in the appropriate navigator (`MainTabs.tsx` or `RootNavigator.tsx`).

## 🗄️ Backend & Database (Supabase)
- **Schema Changes**: If you need to change the database schema, do not edit existing migrations. Create a new SQL file in `supabase/migrations/` (e.g., `002_add_user_preferences.sql`).
- **Edge Functions**: Edge functions live in `supabase/functions/`. When testing locally, ensure you use the Supabase CLI (`supabase functions serve`).

## 🚨 Troubleshooting Common Issues
- **Virtualization Bugs (Missing Text/Blank Spaces)**: If the text list turns blank when scrolling rapidly, check `rowHeightCacheRef` in `ReaderView.tsx`. The `FlashList` relies on perfectly accurate estimated offsets.
- **Audio Sync Desync**: If the karaoke highlighting drifts from the audio, check the `useCoarseSyncTime` polling interval or verify that the `timestamp_start_ms` data in the book JSON matches the audio file length.
