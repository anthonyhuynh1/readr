# WhisperX alignment pipeline (scaffold)

WhisperX is **not** invoked by the mobile app. It is an offline batch step that
produces canonical chapter sync JSON assets uploaded to Supabase Storage.

## Purpose

Given:

- LibriVox MP3 audio for a chapter
- Standard Ebooks sentence text (already ingested)
- Measured `audio_offset_ms` (LibriVox intro silence)

Produce:

- `assets/sync/{book_slug}/{chapter}.json` matching `ChapterSyncAsset` schema
- Updated `sync_hash` + `sync_version` for cache invalidation

## Prerequisites (when you run this for real)

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install whisperx torch
```

GPU strongly recommended for full-book runs.

## Planned workflow

1. **Measure offset** — detect first spoken word vs. file start; write `audio_offset_ms`.
2. **Transcribe + align** — WhisperX forced alignment against known sentence tokens.
3. **Export** — emit minified `{ w, s, e }` words per sentence; gzip for Storage.
4. **Validate** — run `npx tsx scripts/alignment/exportSyncAssets.ts` diff check.
5. **Upload** — push to `sync/{book_slug}/{chapter}.json` and update `chapters.sync_hash`.

## Stub entrypoint

```bash
python scripts/alignment/whisperx/align_chapter.py \
  --audio path/to/chapter.mp3 \
  --sentences path/to/sentences.json \
  --offset-ms 18000 \
  --out path/to/sync.json
```

The stub prints the expected CLI contract and exits. Replace the body with a
real WhisperX pipeline when you are ready to generate production sync data.

## MVP note

The app ships with deterministic seeded sync JSON from `mockChapter.ts`.
WhisperX replaces those timestamps when LibriVox audio is wired end-to-end.
