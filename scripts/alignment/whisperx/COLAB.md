# WhisperX alignment on Google Colab (GPU)

Run this **once** per chapter to produce `assets/sync/{book}/ch-{n}.json`.
Commit the sync JSON to the repo; CI validates it without running WhisperX.

## Files you need

From this repo (after `npm run align:extract` and `npm run fetch:gatsby-audio`):

| File | Repo path |
|------|-----------|
| Audio | `assets/audio/gatsby-ch1-librivox.mp3` |
| Sentences | `assets/align/the-great-gatsby/ch-1-sentences.json` |
| Script | `scripts/alignment/whisperx/align_chapter.py` |

Upload all three to Colab (or clone the repo in Colab).

### Upload files to Colab (required)

Colab only sees files you upload into **`/content/`** (or clone into that folder).

1. In the left sidebar, click the **folder icon** (Files).
2. Click **Upload** (page icon with up arrow).
3. Upload these three files from your PC:

   | Upload from your PC | Must appear in Colab as |
   |---------------------|-------------------------|
   | `assets/audio/gatsby-ch1-librivox.mp3` | `/content/gatsby-ch1-librivox.mp3` |
   | `assets/align/the-great-gatsby/ch-1-sentences.json` | `/content/ch-1-sentences.json` |
   | `scripts/alignment/whisperx/align_chapter.py` | `/content/align_chapter.py` |

4. Wait until all three show **100%** in the Files panel.

**Alternative — clone the repo** (if your project is on GitHub):

```python
!git clone https://github.com/YOUR_USER/readr.git
%cd readr
!ls scripts/alignment/whisperx/align_chapter.py
```

Then use full paths in the alignment command (see step 3 below).

## Colab cells

### 1. GPU runtime

Runtime → Change runtime type → **T4 GPU** (or better).

### 2. Install dependencies

Colab ships pinned versions of pandas/numpy/numba. WhisperX may upgrade them and pip will print **dependency conflict warnings** — that is normal. The install still usually works.

**Option A — try the quick install first** (run alignment next; only fix if imports fail):

```python
!pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu121
!pip install -q whisperx rapidfuzz
```

**Option B — if you get numpy/numba errors**, restart runtime (Runtime → Restart session), then run this pinned install instead:

```python
!pip install -q "numpy>=1.22,<2.1" "pandas>=2.0,<2.4"
!pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu121
!pip install -q whisperx rapidfuzz
```

**Smoke test** (optional — run before alignment):

```python
import whisperx
import rapidfuzz
print("whisperx OK")
```

Adjust the torch index URL if Colab’s CUDA version differs (Runtime → Change runtime type shows GPU type).

### 2b. Verify files exist (run before alignment)

```python
import os
for name in [
    "align_chapter.py",
    "gatsby-ch1-librivox.mp3",
    "ch-1-sentences.json",
]:
    path = f"/content/{name}"
    print("OK" if os.path.isfile(path) else "MISSING", path)
```

All three must print **OK**. If any say **MISSING**, upload that file (step above) or fix paths.

### 3. Run alignment

```python
%cd /content
!python align_chapter.py \
  --audio gatsby-ch1-librivox.mp3 \
  --sentences ch-1-sentences.json \
  --chapter-slug the-great-gatsby-ch-1 \
  --out the-great-gatsby-ch-1-sync.json \
  --stats-out alignment-stats.json \
  --device cuda \
  --whisper-model large-v2
```

If you cloned the repo instead of uploading, use full paths:

```python
!python readr/scripts/alignment/whisperx/align_chapter.py \
  --audio readr/assets/audio/gatsby-ch1-librivox.mp3 \
  --sentences readr/assets/align/the-great-gatsby/ch-1-sentences.json \
  --chapter-slug the-great-gatsby-ch-1 \
  --out the-great-gatsby-ch-1-sync.json \
  --device cuda \
  --whisper-model large-v2
```

On CPU (slow, ~30+ min for ch.1):

```python
!python align_chapter.py ... --device cpu --whisper-model medium
```

### 4. Inspect output

```python
import json
with open("the-great-gatsby-ch-1-sync.json") as f:
    sync = json.load(f)
print("offset_ms:", sync["audio_offset_ms"])
print("sentences:", len(sync["sentences"]))
print("first words:", sync["sentences"][0]["words"][:5])
print("last end_ms:", sync["sentences"][-1]["end_ms"])
```

Expect:

- `audio_offset_ms` > 0 (LibriVox disclaimer skipped)
- `sentences[0].words[0].s` === 0
- Match rate printed during run ≥ 90%

### 5. Download and place in repo

Download `the-great-gatsby-ch-1-sync.json` from Colab’s file browser.

Save as:

```
assets/sync/the-great-gatsby/ch-1.json
```

Then locally:

```bash
npm run validate:sync
npm run seed:supabase
npx expo start -c
```

Profile → **Audio enabled** → open Gatsby ch.1 → test play + karaoke.

## Disk full (~112 GB)?

Colab VMs have a fixed disk (~112 GB total). **A brand-new runtime already uses ~50–70 GB** for Colab’s pre-installed stack (Python, CUDA, Jupyter, pandas, etc.). That is normal — you cannot (and should not) delete those system folders.

**Your files** live in `/content/` and hidden caches under `/root/.cache/`. WhisperX model downloads also land in `/root/.cache/huggingface/` (many GB).

### Check what is yours vs system (run on a fresh runtime)

```python
!echo "=== Your upload area (should be small or empty after reset) ==="
!du -sh /content 2>/dev/null
!ls -la /content

!echo "=== ML caches (safe to delete if you need room) ==="
!du -sh /root/.cache 2>/dev/null
!du -sh /root/.cache/* 2>/dev/null | sort -hr | head -10

!echo "=== Total disk ==="
!df -h /
```

After **Factory reset**, `/content` should be **empty or nearly empty** (~0–50 MB). If `/content` is small but the disk bar still looks ~50% full, that is just the Colab base image — you still have room to run alignment.

Only worry if **`df -h`** shows **Use% near 100%** or alignment fails with “No space left on device”.

### Fastest fix — factory reset

**Runtime → Factory reset runtime** (or **Disconnect and delete runtime**)

This wipes the entire VM disk. You start fresh: re-upload your 3 files, re-run install, then alignment.

Your local PC files are unaffected. Download `the-great-gatsby-ch-1-sync.json` first if you already generated it.

### See what is using space

```python
!du -sh /content/* /root/.cache/* 2>/dev/null | sort -hr | head -20
```

Typical hogs:

| Path | What it is |
|------|------------|
| `/root/.cache/huggingface/` | Whisper / wav2vec model weights (many GB) |
| `/root/.cache/torch/` | PyTorch hub cache |
| `/content/.venv` or old clones | Leftover installs |

### Manual cleanup (if you want to keep the runtime)

```python
import shutil
from pathlib import Path

for path in [
    "/root/.cache/huggingface",
    "/root/.cache/torch",
    "/root/.cache/whisper",
]:
    p = Path(path)
    if p.exists():
        shutil.rmtree(p)
        print("removed", path)

!pip cache purge
!du -sh /content /root/.cache 2>/dev/null
```

Then re-upload only the 3 files you need and use **`medium`** instead of `large-v2` to save ~3–5 GB:

```python
!python align_chapter.py ... --whisper-model medium --device cuda
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Disk full / 112 GB used | Factory reset runtime; re-upload 3 files; use `--whisper-model medium` |
| `can't open file align_chapter.py` | Upload the script to `/content/` (Files panel) and run the verify cell (2b); all three files must show OK |
| pip dependency conflict warnings (pandas/numpy/opentelemetry) | Usually safe to ignore — run the smoke test cell; use Option B install if imports fail |
| Match rate below 90% | Wrong audio edition; confirm LibriVox Kara Shallenberg ch.1 URL |
| CUDA OOM | Use `--whisper-model medium` or smaller batch |
| First word anchor error | Disclaimer may be very long; check `--stats-out` for `raw_chapter_start_ms` |
| Empty whisper words | Re-run with `--device cpu` to rule out GPU driver issues |

## Local (non-Colab) setup

```bash
cd scripts/alignment/whisperx
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install torch torchaudio
pip install -r requirements.txt

python align_chapter.py \
  --audio ../../../assets/audio/gatsby-ch1-librivox.mp3 \
  --sentences ../../../assets/align/the-great-gatsby/ch-1-sentences.json \
  --chapter-slug the-great-gatsby-ch-1 \
  --out ../../../assets/sync/the-great-gatsby/ch-1.json
```
