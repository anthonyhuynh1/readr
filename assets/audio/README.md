# Audio assets

## Current demo (Phase 3)

| File | What it actually is |
|------|---------------------|
| `demo-chapter.mp3` | **Placeholder music** ([SoundHelix Song 1](https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3)) — used early on because Archive.org streaming failed on iOS. It is **not** Gatsby narration. |

Phase 3 validates **playback + karaoke timing**, not audiobook content. Hearing music is expected with the placeholder file.

## Real narration (LibriVox)

Public-domain Gatsby chapter 1 (128 kbps):

https://archive.org/download/greatgatsby_2101_librivox/greatgatsby_01_fitzgerald_128kb.mp3

Fetch into the repo:

```bash
npm run fetch:gatsby-audio
```

That saves `assets/audio/gatsby-ch1-librivox.mp3`. Re-seed:

```bash
npm run seed:supabase
```

LibriVox recordings usually start with a **spoken disclaimer** (~10–20 s) before the chapter. After switching to real audio, set `audio_offset_ms` in seed to match (or run WhisperX alignment — see `scripts/alignment/whisperx/README.md`).

## License

LibriVox recordings are public domain in the USA. SoundHelix music is used only as a temporary dev placeholder.
