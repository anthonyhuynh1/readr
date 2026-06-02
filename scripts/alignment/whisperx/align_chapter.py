#!/usr/bin/env python3
"""
Align LibriVox chapter audio to reference text via WhisperX + DTW word mapping.

WhisperX transcribes freely; reference tokens from sentences.json are mapped onto
WhisperX word timestamps with sequence alignment (handles punctuation / token gaps).

Usage:
  python align_chapter.py \\
    --audio chapter.mp3 \\
    --sentences ch-1-sentences.json \\
    --out sync/ch-1.json \\
    --chapter-slug the-great-gatsby-ch-1
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from rapidfuzz import fuzz
except ImportError:  # pragma: no cover
    fuzz = None  # type: ignore


DEFAULT_PRE_ROLL_MS = 250
DEFAULT_MATCH_THRESHOLD = 0.90
DEFAULT_WHISPER_MODEL = 'large-v2'


@dataclass
class RefWord:
    sentence_id: str
    sentence_index: int
    word_index: int
    display: str
    normalized: str


@dataclass
class HypWord:
    display: str
    normalized: str
    start_ms: int
    end_ms: int


@dataclass
class AlignmentStats:
    reference_words: int
    matched_words: int
    gap_words: int
    match_rate: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Align chapter audio to reference text (WhisperX + DTW)')
    parser.add_argument('--audio', required=True, help='Path to chapter MP3')
    parser.add_argument('--sentences', required=True, help='Chapter align input JSON from align:extract')
    parser.add_argument('--out', required=True, help='Output ChapterSyncAsset JSON path')
    parser.add_argument('--chapter-slug', default='', help='Chapter slug override')
    parser.add_argument('--pre-roll-ms', type=int, default=DEFAULT_PRE_ROLL_MS, help='Seek pre-roll before first word')
    parser.add_argument(
        '--match-threshold',
        type=float,
        default=DEFAULT_MATCH_THRESHOLD,
        help='Minimum fraction of reference words that must match (0-1)',
    )
    parser.add_argument('--whisper-model', default=DEFAULT_WHISPER_MODEL, help='WhisperX model size')
    parser.add_argument('--device', default='cuda', help='cuda or cpu')
    parser.add_argument('--stats-out', default='', help='Optional alignment stats JSON path')
    return parser.parse_args()


def normalize_token(token: str) -> str:
    text = unicodedata.normalize('NFKC', token).lower()
    text = text.strip(" \t\n\r\"'“”‘’`,.!?;:()[]{}—–-…")
    return text


def tokenize_display(text: str) -> list[str]:
    return [part for part in re.split(r'\s+', text.strip()) if part]


def load_align_input(path: Path) -> dict[str, Any]:
    with path.open(encoding='utf-8') as fh:
        data = json.load(fh)

    if isinstance(data, list):
        return {
            'chapter_slug': '',
            'sentences': [{'id': f's-{i}', 'index': i, 'text': s} for i, s in enumerate(data)],
        }

    sentences = data.get('sentences', [])
    if not sentences:
        raise ValueError('sentences JSON has no sentences array')

    return data


def flatten_reference_words(sentences: list[dict[str, Any]]) -> list[RefWord]:
    words: list[RefWord] = []
    for sentence in sentences:
        sentence_id = sentence['id']
        sentence_index = int(sentence['index'])
        tokens = tokenize_display(sentence['text'])
        for word_index, display in enumerate(tokens):
            normalized = normalize_token(display)
            if not normalized:
                continue
            words.append(
                RefWord(
                    sentence_id=sentence_id,
                    sentence_index=sentence_index,
                    word_index=word_index,
                    display=display,
                    normalized=normalized,
                )
            )
    return words


def token_similarity(a: str, b: str) -> float:
    if a == b:
        return 0.0
    if not a or not b:
        return 1.0
    if fuzz is not None:
        ratio = fuzz.ratio(a, b) / 100.0
        return 1.0 - ratio
    return 0.5 if a != b else 0.0


def dtw_align(ref: list[str], hyp: list[str], gap_penalty: float = 0.65) -> list[int | None]:
    """Return hyp index per ref index (None = gap / unmatched reference word)."""
    n = len(ref)
    m = len(hyp)
    if n == 0:
        return []

    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = dp[i - 1][0] + gap_penalty
    for j in range(1, m + 1):
        dp[0][j] = dp[0][j - 1] + gap_penalty * 0.35

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sub = token_similarity(ref[i - 1], hyp[j - 1])
            dp[i][j] = min(
                dp[i - 1][j - 1] + sub,
                dp[i - 1][j] + gap_penalty,
                dp[i][j - 1] + gap_penalty * 0.35,
            )

    mapping: list[int | None] = [None] * n
    i, j = n, m
    assignments: list[tuple[int, int | None]] = []

    while i > 0 or j > 0:
        if i > 0 and j > 0:
            sub = token_similarity(ref[i - 1], hyp[j - 1])
            if abs(dp[i][j] - (dp[i - 1][j - 1] + sub)) < 1e-9:
                assignments.append((i - 1, j - 1))
                i -= 1
                j -= 1
                continue
        if i > 0 and abs(dp[i][j] - (dp[i - 1][j] + gap_penalty)) < 1e-9:
            assignments.append((i - 1, None))
            i -= 1
            continue
        if j > 0:
            j -= 1
            continue
        break

    assignments.reverse()
    for ref_idx, hyp_idx in assignments:
        mapping[ref_idx] = hyp_idx

    return mapping


def run_whisperx(audio_path: Path, model_name: str, device: str) -> list[HypWord]:
    import whisperx  # lazy import — not required for dry runs

    compute_type = 'float16' if device == 'cuda' else 'int8'
    audio = whisperx.load_audio(str(audio_path))
    model = whisperx.load_model(model_name, device, compute_type=compute_type)
    transcribe_result = model.transcribe(audio, batch_size=16)

    align_model, metadata = whisperx.load_align_model(
        language_code=transcribe_result.get('language', 'en'),
        device=device,
    )
    aligned = whisperx.align(
        transcribe_result['segments'],
        align_model,
        metadata,
        audio,
        device,
        return_char_alignments=False,
    )

    words: list[HypWord] = []
    for segment in aligned.get('segments', []):
        for word_info in segment.get('words', []):
            raw = str(word_info.get('word', '')).strip()
            start = word_info.get('start')
            end = word_info.get('end')
            if not raw or start is None or end is None:
                continue
            normalized = normalize_token(raw)
            if not normalized:
                continue
            words.append(
                HypWord(
                    display=raw,
                    normalized=normalized,
                    start_ms=int(float(start) * 1000),
                    end_ms=int(max(float(end), float(start) + 0.05) * 1000),
                )
            )
    return words


def interpolate_file_ms(index: int, mapping: list[int | None], hyp_words: list[HypWord]) -> int | None:
    if mapping[index] is not None:
        return hyp_words[mapping[index]].start_ms

    prev_ms: int | None = None
    for i in range(index - 1, -1, -1):
        if mapping[i] is not None:
            prev_ms = hyp_words[mapping[i]].end_ms
            break

    next_ms: int | None = None
    for i in range(index + 1, len(mapping)):
        if mapping[i] is not None:
            next_ms = hyp_words[mapping[i]].start_ms
            break

    if prev_ms is not None and next_ms is not None:
        return (prev_ms + next_ms) // 2
    if prev_ms is not None:
        return prev_ms + 120
    if next_ms is not None:
        return max(0, next_ms - 120)
    return None


def interpolate_end_ms(index: int, mapping: list[int | None], hyp_words: list[HypWord], start_ms: int) -> int:
    if mapping[index] is not None:
        return hyp_words[mapping[index]].end_ms

    next_start: int | None = None
    for i in range(index + 1, len(mapping)):
        if mapping[i] is not None:
            next_start = hyp_words[mapping[i]].start_ms
            break
        file_start = interpolate_file_ms(i, mapping, hyp_words)
        if file_start is not None:
            next_start = file_start
            break

    if next_start is not None and next_start > start_ms:
        return next_start
    return start_ms + 200


def build_sync_asset(
    chapter_slug: str,
    ref_words: list[RefWord],
    file_starts: list[int],
    file_ends: list[int],
    raw_chapter_start_ms: int,
    pre_roll_ms: int,
) -> dict[str, Any]:
    audio_offset_ms = max(0, raw_chapter_start_ms - pre_roll_ms)

    by_sentence: dict[str, list[dict[str, Any]]] = {}
    sentence_order: list[tuple[str, int]] = []

    for ref_word, file_start, file_end in zip(ref_words, file_starts, file_ends, strict=True):
        visual_start = max(0, file_start - raw_chapter_start_ms)
        visual_end = max(visual_start + 40, file_end - raw_chapter_start_ms)
        entry = {'w': ref_word.display, 's': visual_start, 'e': visual_end}
        if ref_word.sentence_id not in by_sentence:
            by_sentence[ref_word.sentence_id] = []
            sentence_order.append((ref_word.sentence_id, ref_word.sentence_index))
        by_sentence[ref_word.sentence_id].append(entry)

    sentence_order.sort(key=lambda item: item[1])
    sentences_out: list[dict[str, Any]] = []
    for sentence_id, sentence_index in sentence_order:
        words = by_sentence[sentence_id]
        sentences_out.append(
            {
                'sentence_id': sentence_id,
                'sentence_index': sentence_index,
                'start_ms': words[0]['s'],
                'end_ms': words[-1]['e'],
                'words': words,
            }
        )

    return {
        'schema_version': 1,
        'chapter_slug': chapter_slug,
        'sync_version': 2,
        'audio_offset_ms': audio_offset_ms,
        'sentences': sentences_out,
    }


def main() -> int:
    args = parse_args()

    audio_path = Path(args.audio)
    sentences_path = Path(args.sentences)
    out_path = Path(args.out)

    if not audio_path.exists():
        print(f'error: audio not found: {audio_path}', file=sys.stderr)
        return 1
    if not sentences_path.exists():
        print(f'error: sentences not found: {sentences_path}', file=sys.stderr)
        return 1

    align_input = load_align_input(sentences_path)
    chapter_slug = args.chapter_slug or align_input.get('chapter_slug', '')
    if not chapter_slug:
        print('error: chapter slug missing (pass --chapter-slug)', file=sys.stderr)
        return 1

    ref_words = flatten_reference_words(align_input['sentences'])
    if not ref_words:
        print('error: no reference words extracted', file=sys.stderr)
        return 1

    print(f'Transcribing {audio_path} with WhisperX ({args.whisper_model}, {args.device})…')
    hyp_words = run_whisperx(audio_path, args.whisper_model, args.device)
    if not hyp_words:
        print('error: WhisperX produced no aligned words', file=sys.stderr)
        return 1

    print(f'  whisper words: {len(hyp_words)}')
    print(f'  reference words: {len(ref_words)}')

    mapping = dtw_align(
        [word.normalized for word in ref_words],
        [word.normalized for word in hyp_words],
    )

    matched = sum(1 for idx in mapping if idx is not None)
    gap_words = len(mapping) - matched
    match_rate = matched / len(mapping)
    stats = AlignmentStats(
        reference_words=len(mapping),
        matched_words=matched,
        gap_words=gap_words,
        match_rate=match_rate,
    )

    print(f'  matched: {matched}/{len(mapping)} ({match_rate:.1%})')

    if match_rate < args.match_threshold:
        print(
            f'error: match rate {match_rate:.1%} below threshold {args.match_threshold:.0%}',
            file=sys.stderr,
        )
        return 1

    file_starts: list[int] = []
    file_ends: list[int] = []
    for i, hyp_idx in enumerate(mapping):
        if hyp_idx is not None:
            file_starts.append(hyp_words[hyp_idx].start_ms)
            file_ends.append(hyp_words[hyp_idx].end_ms)
        else:
            start = interpolate_file_ms(i, mapping, hyp_words)
            if start is None:
                print(f'error: could not interpolate timestamp for reference word {i}', file=sys.stderr)
                return 1
            file_starts.append(start)
            file_ends.append(interpolate_end_ms(i, mapping, hyp_words, start))

    raw_chapter_start_ms = file_starts[0]
    first_ref = ref_words[0].normalized
    first_hyp = hyp_words[mapping[0]].normalized if mapping[0] is not None else ''
    if mapping[0] is None or token_similarity(first_ref, first_hyp) > 0.45:
        print(
            f'error: first sentence anchor weak (ref={first_ref!r}, hyp={first_hyp!r})',
            file=sys.stderr,
        )
        return 1

    asset = build_sync_asset(
        chapter_slug,
        ref_words,
        file_starts,
        file_ends,
        raw_chapter_start_ms,
        args.pre_roll_ms,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(asset, indent=2), encoding='utf-8')
    print(f'Wrote {out_path}')
    print(f'  audio_offset_ms: {asset["audio_offset_ms"]}')
    print(f'  sentences:       {len(asset["sentences"])}')
    print(f'  duration_ms:     {asset["sentences"][-1]["end_ms"]}')

    if args.stats_out:
        stats_path = Path(args.stats_out)
        stats_path.parent.mkdir(parents=True, exist_ok=True)
        stats_path.write_text(
            json.dumps(
                {
                    'chapter_slug': chapter_slug,
                    'reference_words': stats.reference_words,
                    'matched_words': stats.matched_words,
                    'gap_words': stats.gap_words,
                    'match_rate': stats.match_rate,
                    'raw_chapter_start_ms': raw_chapter_start_ms,
                    'audio_offset_ms': asset['audio_offset_ms'],
                    'whisper_words': len(hyp_words),
                },
                indent=2,
            ),
            encoding='utf-8',
        )
        print(f'Wrote stats {stats_path}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
