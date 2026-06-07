# Current State

This document tracks the immediate priorities, active bugs, and next steps for the Readr project.
**Last Updated:** June 2026

## 🎯 Next Session Priorities
- [ ] **Documentation**: Add comprehensive header comments to new/modified files (e.g., `PlaybackContext.tsx`, `useTextSelection.ts`, etc.) and JSDoc for new provider hook exports.
- [ ] **Edge Cases**: Stress test the new Word-Level Autoscroll with extremely fast playback speeds.
- [ ] **UI Polish**: Refine the transition animations for the Definition Card and Selection Toolbar.

## 🐛 Known Bugs
- [ ] None currently identified. The Drag Border vertical misalignment, Definition Card pop-up override, and Word-Level Autoscroll have all been resolved.

## 🛠️ Active Work in Progress
- **Refactoring**: The Context Decomposition is largely complete (`PlaybackContext` split out), but we still need to write the remaining JSDoc comments to finalize Phase 3 of the refactoring plan.
