# WhisperX alignment pipeline

WhisperX runs **offline on GPU** (Colab / RunPod). It produces `ChapterSyncAsset` JSON
uploaded to Supabase Storage at seed time.

## Quick start

```bash
npm run align:extract          # mockBook → assets/align/.../sentences.json
npm run fetch:gatsby-audio     # LibriVox MP3 (gitignored)
# → Run align_chapter.py on Colab (see COLAB.md)
npm run validate:sync          # after placing assets/sync/.../ch-1.json
npm run seed:supabase
```

## Pipeline

1. **Extract** — `align:extract` emits reference sentences with stable IDs
2. **Transcribe** — WhisperX transcribes LibriVox audio freely
3. **Map** — DTW aligns WhisperX words onto reference tokens (exact on-screen words)
4. **Offset** — `audio_offset_ms = first_word_start - 250ms` pre-roll
5. **Validate** — `validate:sync` cross-checks against align input
6. **Seed** — prefers `assets/sync/` when present via `chapterMediaManifest`

## Files

| File | Role |
|------|------|
| [`align_chapter.py`](align_chapter.py) | GPU alignment entrypoint |
| [`COLAB.md`](COLAB.md) | Google Colab step-by-step |
| [`requirements.txt`](requirements.txt) | Python deps |

## Coordinate contract

- **One align block = one paragraph** from `mockBook.json` / text asset (via `npm run align:extract`)
- Long literary paragraphs may produce blocks with 80+ words — `validate:sync` warns but does not fail
- Word `{ s, e }` = **visual timeline** (0 = first spoken word of chapter)
- `audio_offset_ms` = file seek position (includes 250ms pre-roll before first word)
- App player auto-seeks to `audio_offset_ms` on load
- **Runtime repair is not applied in the app** — run `npm run repair:sync` before seeding/bundling
