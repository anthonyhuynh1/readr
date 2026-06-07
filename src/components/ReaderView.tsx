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
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';

 
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as any as typeof FlashList;
import { theme } from '../constants/theme';
import { usePlaybackSession } from '../context/PlaybackContext';
import { useAi } from '../context/AiContext';
import { useBookmarks } from '../context/BookmarkContext';
import { usePlaybackStore } from '../store/usePlaybackStore';
import type { Sentence, WordTimestamp } from '../types';
import { estimateRowHeight, getRowItemType } from '../utils/readerRowLayout';
import { shouldShowWordKaraoke } from '../utils/readerViewUtils';
import { useTextSelection } from '../hooks/useTextSelection';
import { ParagraphRow, type SelectionRange } from './read/ParagraphRow';
import { SelectionToolbar } from './read/SelectionToolbar';
import { DefinitionCard } from './read/DefinitionCard';
import { ReturnToSyncBtn } from './read/ReturnToSyncBtn';
import { SelectionHandle } from './read/SelectionHandle';

const SCROLL_RETRY_MS = 100;

export function ReaderView() {
  const [isUserScrolledAway, setIsUserScrolledAway] = React.useState(false);
  const [syncDirection, setSyncDirection] = React.useState<'up' | 'down'>('down');

  const listRef = useRef<FlashList<Sentence>>(null);
  const forceScrollRef = useRef(false);
  const rowHeightCacheRef = useRef<Record<number, number>>({});
  const wordLayoutsRef = useRef<Record<number, Record<number, { x: number; y: number; width: number; height: number }>>>({});
  const scrollYRef = useRef(0);
  const scrollYAnim = useRef(new Animated.Value(0)).current;
  
  // Track the container's window-Y so toolbar can be positioned correctly within it.
  const containerRef = useRef<View>(null);
  const containerTopRef = useRef(0);
  const containerHeightRef = useRef(800); // sensible default before measure

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
    defineSelection,
    updateSelectionRange,
  } = useTextSelection();

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    containerHeightRef.current = event.nativeEvent.layout.height;
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
      let targetRowY = 0;
      
      // Start accumulating Y from top padding
      let currentY = theme.spacing.xl;

      // Find the sentence under the finger by accumulating row heights
      for (let i = 0; i < chapter.sentences.length; i++) {
        const height = rowHeightCacheRef.current[i] ?? estimateRowHeight(chapter.sentences[i]);
        const rowY = currentY;
        const rowBottom = currentY + height;

        if (contentY >= rowY && contentY <= rowBottom) {
          targetSentenceIndex = i;
          targetRowY = rowY;
          break;
        }

        const diff = Math.min(
          Math.abs(contentY - rowY),
          Math.abs(contentY - rowBottom)
        );
        if (diff < minDiff) {
          minDiff = diff;
          targetSentenceIndex = i;
          targetRowY = rowY;
        }
        
        currentY += height;
      }

      if (targetSentenceIndex === -1) return;

      const wordLayouts = wordLayoutsRef.current[targetSentenceIndex];
      if (!wordLayouts) return;

      // Padding Horizontal is applied to contentContainerStyle, so item X is indented
      const relativeX = pageX - theme.spacing.lg;
      const relativeY = contentY - targetRowY;

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
      text_preview: getSelectedText(chapter.sentences),
      timestamp_start_ms: selection.word?.start_ms ?? 0,
    });
    clearSelection();
  }, [selection, userId, addBookmark, book, chapter, clearSelection, getSelectedText]);

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
        offset += (rowHeightCacheRef.current[i] ?? estimateRowHeight(sentence)) + theme.spacing.lg;
      }
      return Math.max(0, offset - containerHeightRef.current * 0.3);
    },
    [chapter.sentences],
  );

  const scrollToSentence = useCallback(
    (index: number, animated = true) => {
      listRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition: 0.3,
      });
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index,
          animated,
          viewPosition: 0.3,
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
            viewPosition: 0.3,
          });
        }, SCROLL_RETRY_MS);
      }, SCROLL_RETRY_MS * 2);
    },
    [getEstimatedOffset],
  );

  const handleScrollBeginDrag = useCallback(() => {
    setIsUserScrolledAway(true);
    // Scrolling away from a selection = implicit dismiss.
    clearSelection();
  }, [clearSelection]);

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
    (index: number, height: number) => {
      if (height > 0) {
        rowHeightCacheRef.current[index] = height;
      }
    },
    []
  );

  const handleActiveWordChange = useCallback((sentenceIndex: number, wordIndex: number) => {
    if (!followMode || isUserScrolledAway || !isImmersive || !isPlaying) return;

    const wLayouts = wordLayoutsRef.current[sentenceIndex];
    if (!wLayouts) return;
    const wLayout = wLayouts[wordIndex];
    if (!wLayout) return;

    let rowY = theme.spacing.xl;
    for (let i = 0; i < sentenceIndex; i++) {
      rowY += (rowHeightCacheRef.current[i] ?? estimateRowHeight(chapter.sentences[i])) + theme.spacing.lg;
    }

    const absoluteY = rowY + wLayout.y;
    const screenY = absoluteY - scrollYRef.current;
    const containerHeight = containerHeightRef.current;

    const minSweetSpot = scrollYRef.current < 50 ? 0 : containerHeight * 0.2;

    if (screenY > containerHeight * 0.7 || screenY < minSweetSpot) {
      const targetOffset = Math.max(0, absoluteY - containerHeight * 0.3);
      listRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: true,
      });
      // Important: don't let the sentence-level scroll fight with us
      forceScrollRef.current = false;
    }
  }, [followMode, isUserScrolledAway, isImmersive, isPlaying, chapter.sentences, estimateRowHeight]);

  // ── Follow-mode scroll effects ────────────────────────────────────────────

  useEffect(() => {
    if (activeSentenceIndex < 0 || !isImmersive || !followMode) return;
    if (isUserScrolledAway && !forceScrollRef.current) return;
    
    if (!forceScrollRef.current) {
      let rowY = theme.spacing.xl;
      for (let i = 0; i < activeSentenceIndex; i++) {
        rowY += rowHeightCacheRef.current[i] ?? estimateRowHeight(chapter.sentences[i]);
      }
      
      const screenY = rowY - scrollYRef.current;
      const containerHeight = containerHeightRef.current;
      
      // Sweet spot: between 20% and 70% of the screen height
      // Exception: If near the absolute top of the document, allow 0% to prevent stuck scrolls
      const minSweetSpot = scrollYRef.current < 50 ? 0 : containerHeight * 0.2;
      
      if (screenY >= minSweetSpot && screenY <= containerHeight * 0.7) {
        return; // It's in the sweet spot, no need to scroll
      }
    }

    scrollToSentence(activeSentenceIndex);
    forceScrollRef.current = false;
  }, [activeSentenceIndex, isImmersive, followMode, isUserScrolledAway, scrollToSentence, chapter.sentences]);

  useEffect(() => {
    if (scrollToSentenceIndex === null) return;
    setIsUserScrolledAway(false);
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
          setIsUserScrolledAway(false);
          void seekToWord(startMs);
        }}
        onWordLongPress={handleWordLongPress}
        selectionRange={selection}
        onWordLayout={handleWordLayout}
        onActiveWordChange={handleActiveWordChange}
        onLayout={(height) => handleRowLayout(index, height)}
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

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollYAnim } } }],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
        
        // Dynamically update the sync arrow direction if we're scrolled away
        if (isUserScrolledAway && isImmersive && isPlaying) {
          const targetOffset = getEstimatedOffset(activeSentenceIndex);
          const newDirection = scrollYRef.current > targetOffset ? 'up' : 'down';
          if (newDirection !== syncDirection) {
            setSyncDirection(newDirection);
          }
        }
      },
    },
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

  const getWordPosition = useCallback(
    (sentenceIndex: number, wordIndex: number) => {
      const wordLayouts = wordLayoutsRef.current[sentenceIndex];
      if (!wordLayouts) return null;
      const wLayout = wordLayouts[wordIndex];
      if (!wLayout) return null;

      let rowY = theme.spacing.xl;
      for (let i = 0; i < sentenceIndex; i++) {
        rowY += (rowHeightCacheRef.current[i] ?? estimateRowHeight(chapter.sentences[i])) + theme.spacing.lg;
      }

      return {
        x: theme.spacing.lg + wLayout.x,
        y: rowY + wLayout.y,
        width: wLayout.width,
        height: wLayout.height,
      };
    },
    [chapter.sentences]
  );

  const startPos = selection ? getWordPosition(selection.startSentenceIndex, selection.startWordIndex) : null;
  const endPos = selection ? getWordPosition(selection.endSentenceIndex, selection.endWordIndex) : null;

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

      <AnimatedFlashList
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

      {/* Global Animated Selection Handles */}
      {selection && startPos && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: startPos.y,
            left: startPos.x,
            width: startPos.width,
            height: startPos.height,
            transform: [{ translateY: Animated.multiply(scrollYAnim, -1) }],
            zIndex: 100,
          }}
        >
          <SelectionHandle
            type="start"
            onDragMove={(x, y) => handleDragSelectionHandle('start', x, y)}
          />
        </Animated.View>
      )}
      {selection && endPos && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: endPos.y,
            left: endPos.x,
            width: endPos.width,
            height: endPos.height,
            transform: [{ translateY: Animated.multiply(scrollYAnim, -1) }],
            zIndex: 100,
          }}
        >
          <SelectionHandle
            type="end"
            onDragMove={(x, y) => handleDragSelectionHandle('end', x, y)}
          />
        </Animated.View>
      )}

      {/* Floating toolbar — hovers above the selected word */}
      {selection ? (
        <SelectionToolbar
          selection={selection}
          selectedText={getSelectedText(chapter.sentences)}
          isMultiSentence={isMultiWord}
          onBookmark={handleToolbarBookmark}
          onAskAi={handleToolbarAskAi}
          onDefine={!isMultiWord ? defineSelection : undefined}
          onDismiss={clearSelection}
        />
      ) : null}

      <ReturnToSyncBtn
        visible={isUserScrolledAway && isImmersive && isPlaying}
        direction={syncDirection}
        onPress={() => {
          setIsUserScrolledAway(false);
          forceScrollRef.current = true;
          scrollToSentence(activeSentenceIndex);
        }}
      />

      {/* Definition card — slides up from bottom of reader area */}
      <DefinitionCard
        visible={
          !!selection &&
          !isMultiWord &&
          (isLoadingDefinition || !!definition || isTranslating || !!translatedText || !!translationError)
        }
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
