#!/usr/bin/env python3
"""
WhisperX chapter alignment stub.

This script documents the offline pipeline contract. It does NOT run WhisperX
until dependencies are installed and the body is implemented.

Usage:
  python align_chapter.py \\
    --audio chapter.mp3 \\
    --sentences sentences.json \\
    --offset-ms 18000 \\
    --out sync.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Align chapter audio to text (WhisperX stub)')
    parser.add_argument('--audio', required=True, help='Path to LibriVox MP3')
    parser.add_argument('--sentences', required=True, help='JSON array of sentence strings')
    parser.add_argument('--offset-ms', type=int, default=0, help='LibriVox intro offset in ms')
    parser.add_argument('--out', required=True, help='Output ChapterSyncAsset JSON path')
    parser.add_argument('--chapter-slug', default='', help='Chapter slug for asset metadata')
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    audio = Path(args.audio)
    sentences_path = Path(args.sentences)
    out_path = Path(args.out)

    if not audio.exists():
        print(f'error: audio not found: {audio}', file=sys.stderr)
        return 1
    if not sentences_path.exists():
        print(f'error: sentences not found: {sentences_path}', file=sys.stderr)
        return 1

    with sentences_path.open(encoding='utf-8') as fh:
        sentences = json.load(fh)

    print('WhisperX alignment stub — not yet implemented.')
    print(f'  audio:       {audio}')
    print(f'  sentences:   {len(sentences)} items')
    print(f'  offset_ms:   {args.offset_ms}')
    print(f'  chapter_slug:{args.chapter_slug or "(unset)"}')
    print(f'  out:         {out_path}')
    print()
    print('Next step: install whisperx and implement forced alignment here.')
    print('See scripts/alignment/whisperx/README.md for the full pipeline.')

    # Placeholder asset so downstream tooling can validate schema wiring.
    placeholder = {
        'schema_version': 1,
        'chapter_slug': args.chapter_slug or 'placeholder-chapter',
        'sync_version': 0,
        'audio_offset_ms': args.offset_ms,
        'sentences': [],
        '_stub': True,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(placeholder, indent=2), encoding='utf-8')
    print(f'Wrote placeholder asset to {out_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
