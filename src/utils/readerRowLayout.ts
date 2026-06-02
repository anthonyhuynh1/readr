import { theme } from '../constants/theme';
import type { Sentence } from '../types';

const ROW_MARGIN = theme.spacing.lg;
const LINE_HEIGHT = theme.typography.reader.lineHeight;
const CHARS_PER_LINE = 42;

/** FlashList size hint before a row is measured on screen. */
export function estimateRowHeight(sentence: Sentence): number {
  const textLen = sentence.text.length || sentence.words.length * 5;
  const lines = Math.max(1, Math.ceil(textLen / CHARS_PER_LINE));
  return lines * LINE_HEIGHT + ROW_MARGIN;
}

/** FlashList item type for recycling short vs long blocks. */
export function getRowItemType(sentence: Sentence): 'short' | 'long' {
  return sentence.words.length > 60 ? 'long' : 'short';
}
