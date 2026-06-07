/**
 * ParagraphRow — Renders a single sentence as individually pressable words.
 *
 * Two variants:
 *   StaticParagraphRow          — non-karaoke rows; word tap = seek, long-press = definition
 *   ActiveKaraokeParagraphRow   — active sentence during playback; word-level animation
 *
 * Selection props (isSentenceSelected, selectedWordIndex, onWordLongPress) power
 * the Kindle-style selection UX: highlighted sentence + individual word highlight
 * (yellow, visually distinct from the orange karaoke colours) + floating toolbar
 * + definition card.
 */
import React, { memo, useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { theme } from '../../constants/theme';
import { useCoarseSyncTime } from '../../hooks/useCoarseSyncTime';
import type { Sentence, WordTimestamp } from '../../types';
import { findActiveWordIndexInSentence } from '../../utils/karaoke';
import {
  buildParagraphSentenceSpans,
  findActiveSpanIndex,
  KARAOKE_WORD_SPAN_FALLBACK_THRESHOLD,
  wordsForSpan,
} from '../../utils/paragraphSentences';
import { KaraokeWord } from '../KaraokeWord';
import { SelectionHandle } from './SelectionHandle';

export interface SelectionRange {
  startSentenceIndex: number;
  startWordIndex: number;
  endSentenceIndex: number;
  endWordIndex: number;
}

interface ParagraphRowProps {
  sentence: Sentence;
  isActiveSentence: boolean;
  isImmersive: boolean;
  isPlaying: boolean;
  /** Word-level karaoke — true only for the active sentence while audio is playing. */
  showWordKaraoke: boolean;
  onSpanSeek: (startMs: number) => void;
  /** Long-press on any individual word — triggers definition card + toolbar. */
  onWordLongPress: (
    sentence: Sentence,
    wordIndex: number,
    word: WordTimestamp,
    anchorY: number,
  ) => void;
  /** Current text selection range across the document. */
  selectionRange: SelectionRange | null;
  /** Callback fired when a WordSpan measures its layout (for drag-to-select math). */
  onWordLayout?: (sentenceIndex: number, wordIndex: number, layout: { x: number; y: number; width: number; height: number }) => void;
  /** Callback fired when a drag handle is moved. */
  onDragSelectionHandle?: (type: 'start' | 'end', pageX: number, pageY: number) => void;
  onLayout?: (height: number, y: number) => void;
}

function useParagraphSpans(sentence: Sentence) {
  return useMemo(
    () => buildParagraphSentenceSpans(sentence.words),
    [sentence.words],
  );
}

// ─── Shared word component ────────────────────────────────────────────────────

interface WordSpanProps {
  word: WordTimestamp;
  trailingSpace: boolean;
  isPast: boolean;
  isCurrent: boolean;
  isSelected: boolean;
  showStartHandle: boolean;
  showEndHandle: boolean;
  onPress: (anchorY: number) => void;
  onLongPress: (anchorY: number) => void;
  onWordLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
  onDragSelectionHandle?: (type: 'start' | 'end', pageX: number, pageY: number) => void;
}

const WordSpan = memo(function WordSpan({
  word,
  trailingSpace,
  isPast,
  isCurrent,
  isSelected,
  showStartHandle,
  showEndHandle,
  onPress,
  onLongPress,
  onWordLayout,
  onDragSelectionHandle,
}: WordSpanProps) {
  const ref = useRef<View>(null);

  const handlePress = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => {
      onPress(y);
    });
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => {
      onLongPress(y);
    });
  }, [onLongPress]);

  return (
    <Pressable
      ref={ref as React.RefObject<View>}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      hitSlop={4}
      style={[styles.wordHit, isSelected && styles.wordSelected]}
      onLayout={(e) => onWordLayout?.(e.nativeEvent.layout)}
    >
      {showStartHandle && (
        <SelectionHandle type="start" onDragMove={(x, y) => onDragSelectionHandle?.('start', x, y)} />
      )}
      <Text
        style={[
          styles.readerText,
          isPast && styles.sung,
          isCurrent && styles.activeSpan,
        ]}
      >
        {word.word}{trailingSpace ? ' ' : ''}
      </Text>
      {showEndHandle && (
        <SelectionHandle type="end" onDragMove={(x, y) => onDragSelectionHandle?.('end', x, y)} />
      )}
    </Pressable>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWordInSelectionRange(sentenceIndex: number, wordIndex: number, range: SelectionRange | null) {
  if (!range) return false;
  
  if (sentenceIndex > range.startSentenceIndex && sentenceIndex < range.endSentenceIndex) {
    return true; // entirely within range
  }
  
  if (sentenceIndex === range.startSentenceIndex && sentenceIndex === range.endSentenceIndex) {
    return wordIndex >= range.startWordIndex && wordIndex <= range.endWordIndex;
  }
  
  if (sentenceIndex === range.startSentenceIndex) {
    return wordIndex >= range.startWordIndex;
  }
  
  if (sentenceIndex === range.endSentenceIndex) {
    return wordIndex <= range.endWordIndex;
  }
  
  return false;
}

// ─── Static paragraph row ─────────────────────────────────────────────────────

const StaticParagraphRow = memo(function StaticParagraphRow({
  sentence,
  isActiveSentence,
  isImmersive,
  isPlaying,
  onSpanSeek,
  onWordLongPress,
  selectionRange,
  onWordLayout,
  onDragSelectionHandle,
  onLayout,
}: Omit<ParagraphRowProps, 'showWordKaraoke' | 'selectedWordIndex'>) {
  const spans = useParagraphSpans(sentence);
  const syncTimeMs = useCoarseSyncTime(isActiveSentence ? 100 : 500);
  const activeSpanIndex = useMemo(
    () => (isActiveSentence ? findActiveSpanIndex(spans, syncTimeMs) : -1),
    [isActiveSentence, spans, syncTimeMs],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) =>
      onLayout?.(event.nativeEvent.layout.height, event.nativeEvent.layout.y),
    [onLayout],
  );

  const opacity = isImmersive
    ? isActiveSentence ? theme.opacity.active : theme.opacity.dimmed
    : theme.opacity.active;

  const isSentenceSelected = selectionRange
    ? sentence.index >= selectionRange.startSentenceIndex &&
      sentence.index <= selectionRange.endSentenceIndex
    : false;

  return (
    <View
      style={[
        styles.paragraph,
        isActiveSentence && isImmersive && styles.activeBlock,
        isSentenceSelected && styles.selectedBlock,
        { opacity },
      ]}
      onLayout={handleLayout}
    >
      <View style={styles.sentenceRow}>
        {spans.map((span, si) => {
          const spanWords = wordsForSpan(sentence.words, span);
          const isPastSpan = isActiveSentence && si < activeSpanIndex;

          return (
            <View key={`${sentence.id}-span-${si}`} style={styles.inlineSpan}>
              {spanWords.map((word, wi) => {
                const globalWi = sentence.words.indexOf(word);
                const trailingSpace = wi < spanWords.length - 1 || si < spans.length - 1;
                const isSelected = isWordInSelectionRange(sentence.index, globalWi, selectionRange);
                const showStartHandle =
                  selectionRange?.startSentenceIndex === sentence.index &&
                  selectionRange?.startWordIndex === globalWi;
                const showEndHandle =
                  selectionRange?.endSentenceIndex === sentence.index &&
                  selectionRange?.endWordIndex === globalWi;

                return (
                  <WordSpan
                    key={`${sentence.id}-s${si}-w${word.index}`}
                    word={word}
                    trailingSpace={trailingSpace}
                    isPast={isPastSpan}
                    isCurrent={isActiveSentence && isImmersive && si === activeSpanIndex}
                    isSelected={isSelected}
                    showStartHandle={showStartHandle}
                    showEndHandle={showEndHandle}
                    onDragSelectionHandle={onDragSelectionHandle}
                    onWordLayout={(layout) => onWordLayout?.(sentence.index, globalWi, layout)}
                    onPress={(anchorY) => {
                      if (isPlaying) {
                        onSpanSeek(word.start_ms || span.start_ms);
                      } else {
                        onWordLongPress(sentence, globalWi, word, anchorY);
                      }
                    }}
                    onLongPress={(anchorY) =>
                      onWordLongPress(sentence, globalWi, word, anchorY)
                    }
                  />
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
});

// ─── Active karaoke paragraph row ─────────────────────────────────────────────

/**
 * Active sentence during playback — word-level karaoke animation.
 * Each word (in active span AND non-active spans) has its own onLongPress so
 * users can long-press ANY word while audio plays and get its definition.
 * The View-level touch handler is removed — Pressable.onLongPress handles everything.
 */
const ActiveKaraokeParagraphRow = memo(function ActiveKaraokeParagraphRow({
  sentence,
  isImmersive,
  isPlaying,
  onSpanSeek,
  onWordLongPress,
  selectionRange,
  onWordLayout,
  onDragSelectionHandle,
  onLayout,
}: Omit<ParagraphRowProps, 'showWordKaraoke' | 'isActiveSentence'>) {
  const syncTimeMs = useCoarseSyncTime(50);
  const spans = useParagraphSpans(sentence);

  const activeSpanIndex = useMemo(
    () => findActiveSpanIndex(spans, syncTimeMs),
    [spans, syncTimeMs],
  );

  const activeSpan = spans[activeSpanIndex];
  const activeSpanWords = useMemo(
    () => (activeSpan ? wordsForSpan(sentence.words, activeSpan) : []),
    [activeSpan, sentence.words],
  );

  const activeWordIndexInSpan = useMemo(
    () => findActiveWordIndexInSentence(activeSpanWords, syncTimeMs),
    [activeSpanWords, syncTimeMs],
  );

  const useSolidFallback = activeSpanWords.length > KARAOKE_WORD_SPAN_FALLBACK_THRESHOLD;
  const isKaraokeActive = isImmersive && isPlaying;

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) =>
      onLayout?.(event.nativeEvent.layout.height, event.nativeEvent.layout.y),
    [onLayout],
  );

  const isSentenceSelected = selectionRange
    ? sentence.index >= selectionRange.startSentenceIndex &&
      sentence.index <= selectionRange.endSentenceIndex
    : false;

  /**
   * Render a word inside the ACTIVE karaoke span.
   * Uses KaraokeWord for the current word (fluid fill animation) and plain Pressable
   * for past/future words. Each has onLongPress for definition lookup.
   */
  const renderActiveSpanWord = useCallback(
    (word: WordTimestamp, wi: number, spanKey: string) => {
      const trailingSpace = wi < activeSpanWords.length - 1;
      const isPast = wi < activeWordIndexInSpan;
      const isCurrent = wi === activeWordIndexInSpan;
      const globalWi = sentence.words.indexOf(word);
      const isWordSelected = isWordInSelectionRange(sentence.index, globalWi, selectionRange);
      const showStartHandle =
        selectionRange?.startSentenceIndex === sentence.index &&
        selectionRange?.startWordIndex === globalWi;
      const showEndHandle =
        selectionRange?.endSentenceIndex === sentence.index &&
        selectionRange?.endWordIndex === globalWi;
      
      const key = `${spanKey}-w-${word.index}`;
      const handlePress = (anchorY: number) => {
        if (isPlaying) {
          onSpanSeek(activeSpan?.start_ms ?? word.start_ms);
        } else {
          onWordLongPress(sentence, globalWi, word, anchorY);
        }
      };
      const handleLongPress = (anchorY: number) => {
        onWordLongPress(sentence, globalWi, word, anchorY);
      };

      if (isCurrent && useSolidFallback) {
        return (
          <View key={key} style={isWordSelected && styles.wordSelected} onLayout={(e) => onWordLayout?.(sentence.index, globalWi, e.nativeEvent.layout)}>
            {showStartHandle && (
              <SelectionHandle type="start" onDragMove={(x, y) => onDragSelectionHandle?.('start', x, y)} />
            )}
            <WordSpan
              word={word}
              trailingSpace={trailingSpace}
              isPast={false}
              isCurrent={false}
              isSelected={false}
              showStartHandle={false}
              showEndHandle={false}
              onPress={handlePress}
              onLongPress={handleLongPress}
            />
            {showEndHandle && (
              <SelectionHandle type="end" onDragMove={(x, y) => onDragSelectionHandle?.('end', x, y)} />
            )}
          </View>
        );
      }

      if (isCurrent) {
        return (
          <View key={key} style={isWordSelected && styles.wordSelected} onLayout={(e) => onWordLayout?.(sentence.index, globalWi, e.nativeEvent.layout)}>
            {showStartHandle && (
              <SelectionHandle type="start" onDragMove={(x, y) => onDragSelectionHandle?.('start', x, y)} />
            )}
            <KaraokeWord
              word={word}
              isKaraokeActive={isKaraokeActive}
              trailingSpace={trailingSpace}
              onPress={handlePress}
              onLongPress={handleLongPress}
            />
            {showEndHandle && (
              <SelectionHandle type="end" onDragMove={(x, y) => onDragSelectionHandle?.('end', x, y)} />
            )}
          </View>
        );
      }

      return (
        <WordSpan
          key={key}
          word={word}
          trailingSpace={trailingSpace}
          isPast={isPast}
          isCurrent={false}
          isSelected={isWordSelected}
          showStartHandle={showStartHandle}
          showEndHandle={showEndHandle}
          onDragSelectionHandle={onDragSelectionHandle}
          onWordLayout={(layout) => onWordLayout?.(sentence.index, globalWi, layout)}
          onPress={handlePress}
          onLongPress={handleLongPress}
        />
      );
    },
    [
      activeSpan,
      activeSpanWords.length,
      activeWordIndexInSpan,
      isKaraokeActive,
      onSpanSeek,
      onWordLongPress,
      sentence,
      useSolidFallback,
    ],
  );

  return (
    <View
      style={[
        styles.paragraph,
        styles.activeBlock,
        isSentenceSelected && styles.selectedBlock,
        { opacity: theme.opacity.active },
      ]}
      onLayout={handleLayout}
    >
      <View style={styles.sentenceRow}>
        {spans.map((span, si) => {
          if (si === activeSpanIndex) {
            // Active span — render individual karaoke words.
            const spanWords = wordsForSpan(sentence.words, span);
            return (
              <View key={`${sentence.id}-karaoke-${si}`} style={styles.inlineSpan}>
                {spanWords.map((word, wi) =>
                  renderActiveSpanWord(word, wi, `${sentence.id}-karaoke-${si}`),
                )}
              </View>
            );
          }

          // Non-active spans — render individual words with long-press.
          const spanWords = wordsForSpan(sentence.words, span);
          const isPastSpan = si < activeSpanIndex;
          return (
            <View key={`${sentence.id}-span-${si}`} style={styles.inlineSpan}>
              {spanWords.map((word, wi) => {
                const globalWi = sentence.words.indexOf(word);
                const trailingSpace = wi < spanWords.length - 1 || si < spans.length - 1;
                const isSelected = isWordInSelectionRange(sentence.index, globalWi, selectionRange);
                const showStartHandle =
                  selectionRange?.startSentenceIndex === sentence.index &&
                  selectionRange?.startWordIndex === globalWi;
                const showEndHandle =
                  selectionRange?.endSentenceIndex === sentence.index &&
                  selectionRange?.endWordIndex === globalWi;

                return (
                  <WordSpan
                    key={`${sentence.id}-s${si}-w${word.index}`}
                    word={word}
                    trailingSpace={trailingSpace}
                    isPast={isPastSpan}
                    isCurrent={false}
                    isSelected={isSelected}
                    showStartHandle={showStartHandle}
                    showEndHandle={showEndHandle}
                    onDragSelectionHandle={onDragSelectionHandle}
                    onWordLayout={(layout) => onWordLayout?.(sentence.index, globalWi, layout)}
                    onPress={(anchorY) => {
                      if (isPlaying) {
                        onSpanSeek(span.start_ms);
                      } else {
                        onWordLongPress(sentence, globalWi, word, anchorY);
                      }
                    }}
                    onLongPress={(anchorY) =>
                      onWordLongPress(sentence, globalWi, word, anchorY)
                    }
                  />
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
});

// ─── Public export ────────────────────────────────────────────────────────────

export const ParagraphRow = memo(function ParagraphRow(props: ParagraphRowProps) {
  if (props.showWordKaraoke) {
    return <ActiveKaraokeParagraphRow {...props} />;
  }
  return <StaticParagraphRow {...props} />;
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  paragraph: {
    marginBottom: theme.spacing.lg,
  },
  activeBlock: {
    backgroundColor: 'rgba(255, 107, 0, 0.06)',
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    marginHorizontal: -theme.spacing.sm,
  },
  /**
   * Selected (long-pressed) sentence — yellow highlighter tint.
   * Intentionally different from the orange karaoke active block so the
   * selection is clearly visible even when the sentence is being played.
   */
  selectedBlock: {
    backgroundColor: 'rgba(255, 214, 0, 0.18)',
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    marginHorizontal: -theme.spacing.sm,
  },
  sentenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  inlineSpan: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordHit: {
    flexShrink: 1,
  },
  /** Selected individual word — yellow pill highlight, distinct from orange karaoke. */
  wordSelected: {
    backgroundColor: 'rgba(255, 214, 0, 0.45)',
    borderRadius: 3,
  },
  readerText: {
    fontSize: theme.typography.reader.fontSize,
    lineHeight: theme.typography.reader.lineHeight,
    letterSpacing: theme.typography.reader.letterSpacing,
    color: theme.colors.activeText,
  },
  activeSpan: {
    color: theme.colors.activeText,
  },
  sung: {
    color: theme.colors.brandOrange,
  },
});
