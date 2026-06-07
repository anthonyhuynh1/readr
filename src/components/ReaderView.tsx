/**
 * ReaderView — Scrolling sentence list with karaoke follow-mode, Kindle-style
 * text selection, word definitions, and bookmark/AI actions.
 *
 * Selection dismiss strategy (no overlay Pressable — it gets swallowed by FlashList):
 *   - Word tap (onSpanSeek) → clears selection then seeks
 *   - Scroll drag → clears selection
 *   - FlashList ListFooterComponent Pressable → clears on empty-space tap
 *   - Toolbar buttons → clear on action
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { theme } from '../constants/theme';
import { usePlaybackSession } from '../context/PlaybackContext';
import { useAi } from '../context/AiContext';
import { useBookmarks } from '../context/BookmarkContext';
import { usePlaybackStore } from '../store/usePlaybackStore';
import type { Sentence, WordTimestamp } from '../types';
import { estimateRowHeight, getRowItemType } from '../utils/readerRowLayout';
import { shouldShowWordKaraoke } from '../utils/readerViewUtils';
import { useTextSelection } from '../hooks/useTextSelection';
import { ParagraphRow } from './read/ParagraphRow';
import { SelectionToolbar } from './read/SelectionToolbar';
import { DefinitionCard } from './read/DefinitionCard';

const FOLLOW_SCROLL_OFFSET = 120;
const FOLLOW_PAUSE_MS = 8000;
const SCROLL_RETRY_MS = 100;

export function ReaderView() {
  const listRef = useRef<FlashList<Sentence>>(null);
  const followPausedUntilRef = useRef(0);
  const forceScrollRef = useRef(false);
  const visibleIndicesRef = useRef<Set<number>>(new Set());
  const rowHeightCacheRef = useRef<Record<number, number>>({});
  const rowLayoutsRef = useRef<Record<number, { y: number; height: number }>>({});
  const wordLayoutsRef = useRef<Record<number, Record<number, { x: number; y: number; width: number; height: number }>>>({});
  const scrollYRef = useRef(0);
  
  // Track the container's window-Y so toolbar can be positioned correctly within it.
  const containerRef = useRef<View>(null);
  const containerTopRef = useRef(0);

  const {
    chapter,
    book,
    userId,
    isImmersive,
    audioError,
    seekToWord,
    scrollToSentenceIndex,
    clearScrollTarget,
  } = usePlaybackSession();

  const { openAskAi } = useAi();
  const { addBookmark } = useBookmarks();

  const activeSentenceIndex = usePlaybackStore((s) => s.activeSentenceIndex);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const followMode = usePlaybackStore((s) => s.followMode);
  const syncReady = chapter.syncReady !== false;
  const karaokeEnabled = !audioError && isImmersive && syncReady;

  // ── Text selection (Kindle-style word long-press) ─────────────────────────
  const {
    selection,
    definition,
    isLoadingDefinition,
    translatedText,
    translationError,
    isTranslating,
    isMultiWord,
    selectWord,
    getSelectedText,
    clearSelection,
    translateWord,
    updateSelectionRange,
  } = useTextSelection();

  const handleContainerLayout = useCallback(() => {
    // Measure the container's Y position in window coords so we can convert
    // word anchorY (window-absolute) into container-relative coords for the toolbar.
    containerRef.current?.measureInWindow((_x, y) => {
      containerTopRef.current = y;
    });
  }, []);

  const handleWordLongPress = useCallback(
    (sentence: Sentence, wordIndex: number, word: WordTimestamp, anchorY: number) => {
      // Convert window-absolute Y to container-relative Y for toolbar positioning.
      const containerRelativeY = anchorY - containerTopRef.current;
      selectWord(sentence, wordIndex, word, containerRelativeY);
    },
    [selectWord],
  );

  const handleDragSelectionHandle = useCallback(
    (type: 'start' | 'end', pageX: number, pageY: number) => {
      // Calculate Y coordinate relative to FlashList content.
      // pageY is window coordinate. containerTopRef is window coordinate of FlashList start.
      // scrollYRef is how much FlashList has scrolled.
      const contentY = pageY - containerTopRef.current + scrollYRef.current;

      let targetSentenceIndex = -1;
      let minDiff = Infinity;

      // Find the sentence under the finger
      for (let i = 0; i < chapter.sentences.length; i++) {
        const layout = rowLayoutsRef.current[i];
        if (!layout) continue;

        if (contentY >= layout.y && contentY <= layout.y + layout.height) {
          targetSentenceIndex = i;
          break;
        }

        const diff = Math.min(
          Math.abs(contentY - layout.y),
          Math.abs(contentY - (layout.y + layout.height))
        );
        if (diff < minDiff) {
          minDiff = diff;
          targetSentenceIndex = i;
        }
      }

      if (targetSentenceIndex === -1) return;

      const wordLayouts = wordLayoutsRef.current[targetSentenceIndex];
      if (!wordLayouts) return;

      const targetRowLayout = rowLayoutsRef.current[targetSentenceIndex];
      // Padding Horizontal is applied to contentContainerStyle, so item X is indented
      const relativeX = pageX - theme.spacing.lg;
      const relativeY = contentY - targetRowLayout.y;

      let targetWordIndex = -1;
      let minWordDist = Infinity;

      for (const [wIdxStr, wLayout] of Object.entries(wordLayouts)) {
        const wIdx = parseInt(wIdxStr, 10);
        const cx = wLayout.x + wLayout.width / 2;
        const cy = wLayout.y + wLayout.height / 2;

        const dist = (cx - relativeX) ** 2 + (cy - relativeY) ** 2;
        if (dist < minWordDist) {
          minWordDist = dist;
          targetWordIndex = wIdx;
        }
      }

      if (targetWordIndex !== -1) {
        updateSelectionRange(targetSentenceIndex, targetWordIndex, type);
      }
    },
    [chapter.sentences.length, updateSelectionRange]
  );

  const handleToolbarBookmark = useCallback(() => {
    if (!selection || !userId) return;
    void addBookmark({
      user_id: userId,
      book_slug: book.slug,
      book_title: book.title,
      chapter_slug: chapter.slug,
      chapter_title: chapter.title,
      sentence_id: selection.sentence.id,
      page_hint: chapter.pageNumber,
      line_index: selection.sentence.index,
      text_preview: selection.sentence.text,
      timestamp_start_ms: selection.word?.start_ms ?? 0,
    });
    clearSelection();
  }, [selection, userId, addBookmark, book, chapter, clearSelection]);

  const handleToolbarAskAi = useCallback(() => {
    if (!selection) return;
    // Open Ask AI with either the full range or the single anchor sentence
    const targetSentence = isMultiWord
      ? { ...selection.sentence, text: getSelectedText(chapter.sentences) }
      : selection.sentence;
    
    openAskAi(targetSentence);
    clearSelection();
  }, [selection, chapter.sentences, isMultiWord, getSelectedText, openAskAi, clearSelection]);

  // ── Scroll helpers ────────────────────────────────────────────────────────

  const getEstimatedOffset = useCallback(
    (index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        const sentence = chapter.sentences[i];
        offset += rowHeightCacheRef.current[i] ?? estimateRowHeight(sentence);
      }
      return Math.max(0, offset - FOLLOW_SCROLL_OFFSET);
    },
    [chapter.sentences],
  );

  const scrollToSentence = useCallback(
    (index: number, animated = true) => {
      listRef.current?.scrollToIndex({
        index,
        animated,
        viewOffset: FOLLOW_SCROLL_OFFSET,
      });
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index,
          animated,
          viewOffset: FOLLOW_SCROLL_OFFSET,
        });
      }, SCROLL_RETRY_MS);
      setTimeout(() => {
        listRef.current?.scrollToOffset({
          offset: getEstimatedOffset(index),
          animated: false,
        });
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index,
            animated,
            viewOffset: FOLLOW_SCROLL_OFFSET,
          });
        }, SCROLL_RETRY_MS);
      }, SCROLL_RETRY_MS * 2);
    },
    [getEstimatedOffset],
  );

  const handleScrollBeginDrag = useCallback(() => {
    followPausedUntilRef.current = Date.now() + FOLLOW_PAUSE_MS;
    // Scrolling away from a selection = implicit dismiss.
    clearSelection();
  }, [clearSelection]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      visibleIndicesRef.current = new Set(
        viewableItems
          .map((item) => item.index)
          .filter((index): index is number => index !== null && index !== undefined),
      );
    },
    [],
  );

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: { itemVisiblePercentThreshold: 10 },
      onViewableItemsChanged: handleViewableItemsChanged,
    },
  ]).current;

  const handleWordLayout = useCallback(
    (sentenceIndex: number, wordIndex: number, layout: { x: number; y: number; width: number; height: number }) => {
      if (!wordLayoutsRef.current[sentenceIndex]) {
        wordLayoutsRef.current[sentenceIndex] = {};
      }
      wordLayoutsRef.current[sentenceIndex][wordIndex] = layout;
    },
    []
  );

  const handleRowLayout = useCallback(
    (index: number, height: number, y?: number) => {
      if (height > 0) {
        rowHeightCacheRef.current[index] = height;
        if (y !== undefined) {
          rowLayoutsRef.current[index] = { y, height };
        }
      }
    },
    []
  );

  // ── Follow-mode scroll effects ────────────────────────────────────────────

  useEffect(() => {
    if (activeSentenceIndex < 0 || !isImmersive || !followMode) return;
    if (Date.now() < followPausedUntilRef.current && !forceScrollRef.current) return;
    if (!forceScrollRef.current && visibleIndicesRef.current.has(activeSentenceIndex)) {
      return;
    }
    scrollToSentence(activeSentenceIndex);
    forceScrollRef.current = false;
  }, [activeSentenceIndex, isImmersive, followMode, scrollToSentence]);

  useEffect(() => {
    if (scrollToSentenceIndex === null) return;
    forceScrollRef.current = true;
    scrollToSentence(scrollToSentenceIndex);
    clearScrollTarget();
  }, [scrollToSentenceIndex, scrollToSentence, clearScrollTarget]);

  // ── Render ────────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: Sentence; index: number }) => (
      <ParagraphRow
        sentence={item}
        isActiveSentence={index === activeSentenceIndex}
        isImmersive={isImmersive}
        isPlaying={isPlaying}
        showWordKaraoke={shouldShowWordKaraoke(
          karaokeEnabled,
          isPlaying,
          index,
          activeSentenceIndex,
        )}
        onSpanSeek={(startMs) => {
          // Tapping any word dismisses the active selection, then seeks.
          clearSelection();
          void seekToWord(startMs);
        }}
        onWordLongPress={handleWordLongPress}
        selectionRange={selection}
        onDragSelectionHandle={handleDragSelectionHandle}
        onWordLayout={handleWordLayout}
        onLayout={(height, y) => handleRowLayout(index, height, y)}
      />
    ),
    [
      activeSentenceIndex,
      isImmersive,
      isPlaying,
      karaokeEnabled,
      seekToWord,
      clearSelection,
      handleWordLongPress,
      selection,
      handleRowLayout,
      handleWordLayout,
      handleDragSelectionHandle,
    ],
  );

  const overrideItemLayout = useCallback(
    (
      layout: { span?: number; size?: number },
      item: Sentence,
      index: number,
    ) => {
      layout.size = rowHeightCacheRef.current[index] ?? estimateRowHeight(item);
    },
    [],
  );

  const getItemType = useCallback(
    (item: Sentence, index: number) => {
      if (shouldShowWordKaraoke(karaokeEnabled, isPlaying, index, activeSentenceIndex)) {
        return 'karaoke';
      }
      return getRowItemType(item);
    },
    [karaokeEnabled, isPlaying, activeSentenceIndex],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Tapping empty space below the last sentence also clears selection.
  const listFooter = useCallback(
    () => <Pressable style={styles.listFooter} onPress={clearSelection} />,
    [clearSelection],
  );

  const averageEstimatedSize =
    chapter.sentences.length > 0
      ? Math.round(
          chapter.sentences.reduce((sum, s) => sum + estimateRowHeight(s), 0) /
            chapter.sentences.length,
        )
      : 120;

  const showSyncNotice = chapter.syncReady === false && !audioError;

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={handleContainerLayout}
    >
      {showSyncNotice ? (
        <View style={styles.syncNotice}>
          <Text style={styles.syncNoticeText}>
            Word-by-word sync isn't available for this chapter yet — you can still read and listen.
          </Text>
        </View>
      ) : null}

      <FlashList
        ref={listRef}
        data={chapter.sentences}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={averageEstimatedSize}
        overrideItemLayout={overrideItemLayout}
        getItemType={getItemType}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        ListFooterComponent={listFooter}
        extraData={{
          activeSentenceIndex,
          isImmersive,
          isPlaying,
          karaokeEnabled,
          selectionSentenceId: selection?.sentence.id ?? null,
          selectedWordIndex: selection?.wordIndex ?? null,
        }}
      />

      {/* Floating toolbar — hovers above the selected word */}
      {selection ? (
        <SelectionToolbar
          selection={selection}
          selectedText={getSelectedText(chapter.sentences)}
          isMultiSentence={isMultiWord}
          onBookmark={handleToolbarBookmark}
          onAskAi={handleToolbarAskAi}
          onDismiss={clearSelection}
        />
      ) : null}

      {/* Definition card — slides up from bottom of reader area */}
      <DefinitionCard
        visible={!!selection && !isMultiWord}
        word={selection?.word.word ?? ''}
        definition={definition}
        isLoading={isLoadingDefinition}
        translatedText={translatedText}
        translationError={translationError}
        isTranslating={isTranslating}
        onTranslate={({ targetLanguage }) =>
          void translateWord({
            targetLanguage,
            bookSlug: book.slug,
            chapterSlug: chapter.slug,
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    // overflow:hidden keeps DefinitionCard clipped inside the reader area on Android,
    // preventing it from bleeding over the footer (audio controls) when "hidden".
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    // No bottom padding needed — ListFooterComponent provides the tap target.
  },
  listFooter: {
    height: theme.spacing.xxl * 3,
  },
  syncNotice: {
    backgroundColor: 'rgba(255, 107, 0, 0.08)',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  syncNoticeText: {
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.dimmedText,
  },
});
