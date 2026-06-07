# Project Roadmap & Backlog

This document tracks the long-term vision, upcoming features, and technical debt for the Readr project. It is meant to capture ideas that span across multiple sessions.

## 🚀 Upcoming Features (Backlog)
- [ ] **EPUB Import**: Allow users to import their own EPUB files and parse them into the local SQLite/Supabase schema.
- [ ] **Offline TTS**: Integrate native offline Text-to-Speech fallback when cloud audio is unavailable.
- [ ] **Social Reading**: Allow users to share highlights, bookmarks, and Ask AI insights with friends.
- [ ] **Advanced Analytics**: Track reading speed (WPM), total time spent, and comprehension metrics.
- [ ] **Multi-Device Sync**: Ensure precise synchronization of bookmarks and reading progress across iOS, Android, and Web via Supabase real-time subscriptions.

## 🧹 Technical Debt & Refactoring
- [ ] **Component Library**: Extract common UI elements (buttons, bottom sheets, dialogs) into a shared `src/components/ui` folder to reduce duplication.
- [ ] **Test Coverage**: Introduce Jest and React Native Testing Library for core logical hooks (e.g., `useSyncEngine`, `useTextSelection`).
- [ ] **Database Migrations**: Consolidate the Supabase SQL migrations into a cleaner V2 schema, removing deprecated columns.

## 🧊 Icebox (Future Ideas)
- Translation memory (saving translated words to a personal dictionary/flashcard system).
- Voice commands for hands-free reading control.
