# Changelog

All notable changes to the Readr project will be documented in this file.

## [Unreleased] - June 2026

### Added
- **Word-Level Autoscroll Engine**: Added a highly optimized autoscroll engine in `ReaderView.tsx` that tracks the mathematically exact Y-coordinate of the active spoken word, executing micro-glides to keep the word in the 30-70% sweet spot.
- **Dynamic Sync Arrow**: Integrated native scrolling metrics into `ReturnToSyncBtn`, instantly switching the arrow direction based on the user's scroll position relative to the active audio sentence.
- **On-Demand Definitions**: Extracted the automatic dictionary card pop-up into an explicit "Define / Translate" button on the `SelectionToolbar`.

### Fixed
- **Drag Handle Vertical Alignment**: Removed an erroneous hardcoded `16px` offset that was misaligning the drag handles. Re-architected the `y` coordinate calculation in `ReaderView.tsx` to accurately parse `theme.spacing.lg` padding between paragraphs, permanently fixing the vertical drift of drag handles.
- **Translation Pop-up Ghosting**: Fixed an issue where the `DefinitionCard` would pop up empty just because a user highlighted a single word, by strictly binding its visibility to translation/definition loading states.
