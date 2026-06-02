import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { theme } from '../constants/theme';
import { usePlaybackSession } from '../context/PlaybackContext';
import { usePlaybackStore } from '../store/usePlaybackStore';
import type { Sentence } from '../types';
import { estimateRowHeight, getRowItemType } from '../utils/readerRowLayout';
import { shouldShowWordKaraoke } from '../utils/readerViewUtils';
import { SentenceActionPopover } from './BookmarksPanel';
import { ParagraphRow } from './read/ParagraphRow';

const FOLLOW_SCROLL_OFFSET = 120;
const FOLLOW_PAUSE_MS = 8000;
const SCROLL_RETRY_MS = 100;

export function ReaderView() {
  const listRef = useRef<FlashList<Sentence>>(null);
  const followPausedUntilRef = useRef(0);
  const forceScrollRef = useRef(false);
  const visibleIndicesRef = useRef<Set<number>>(new Set());
  const rowHeightCacheRef = useRef<Record<number, number>>({});

  const {
    chapter,
    book,
    userId,
    isImmersive,
    audioError,
    seekToWord,
    addBookmark,
    openAskAi,
    scrollToSentenceIndex,
    clearScrollTarget,
  } = usePlaybackSession();

  const activeSentenceIndex = usePlaybackStore((s) => s.activeSentenceIndex);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const followMode = usePlaybackStore((s) => s.followMode);
  const syncReady = chapter.syncReady !== false;
  const karaokeEnabled = !audioError && isImmersive && syncReady;

  const [popover, setPopover] = useState<{
    sentence: Sentence;
    anchorY: number;
  } | null>(null);

  const handleSpanSeek = useCallback(
    (startMs: number) => {
      void seekToWord(startMs);
    },
    [seekToWord],
  );

  const handleSentenceLongPress = useCallback(
    (sentence: Sentence, anchorY: number) => {
      setPopover({ sentence, anchorY });
    },
    [],
  );

  const handleBookmark = useCallback(() => {
    if (!popover) return;
    if (!userId) return;
    const firstWord = popover.sentence.words[0];
    void addBookmark({
      user_id: userId,
      book_slug: book.slug,
      book_title: book.title,
      chapter_slug: chapter.slug,
      chapter_title: chapter.title,
      sentence_id: popover.sentence.id,
      page_hint: chapter.pageNumber,
      line_index: popover.sentence.index,
      text_preview: popover.sentence.text,
      timestamp_start_ms: firstWord?.start_ms ?? 0,
    });
    setPopover(null);
  }, [popover, addBookmark, chapter, userId, book]);

  const handleAskAi = useCallback(() => {
    if (!popover) return;
    openAskAi(popover.sentence);
    setPopover(null);
  }, [popover, openAskAi]);

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

      // FlashList scrollToIndex is a no-op until layout exists — retry after measure.
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
  }, []);

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

  const handleRowLayout = useCallback((index: number, height: number) => {
    if (height > 0) {
      rowHeightCacheRef.current[index] = height;
    }
  }, []);

  useEffect(() => {
    if (activeSentenceIndex < 0 || !isImmersive || !followMode) return;
    if (Date.now() < followPausedUntilRef.current && !forceScrollRef.current) return;

    scrollToSentence(activeSentenceIndex);
    forceScrollRef.current = false;
  }, [activeSentenceIndex, isImmersive, followMode, scrollToSentence]);

  useEffect(() => {
    if (scrollToSentenceIndex === null) return;
    forceScrollRef.current = true;
    scrollToSentence(scrollToSentenceIndex);
    clearScrollTarget();
  }, [scrollToSentenceIndex, scrollToSentence, clearScrollTarget]);

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
        onSpanSeek={handleSpanSeek}
        onSentenceLongPress={handleSentenceLongPress}
        onLayout={(height) => handleRowLayout(index, height)}
      />
    ),
    [
      activeSentenceIndex,
      isImmersive,
      isPlaying,
      karaokeEnabled,
      handleSpanSeek,
      handleSentenceLongPress,
      handleRowLayout,
    ],
  );

  const overrideItemLayout = useCallback(
    (
      layout: { span?: number; size?: number },
      item: Sentence,
      index: number,
    ) => {
      layout.size =
        rowHeightCacheRef.current[index] ?? estimateRowHeight(item);
    },
    [],
  );

  const handleScroll = useCallback((_event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // FlashList scroll position tracked via viewability for follow mode.
  }, []);

  const averageEstimatedSize =
    chapter.sentences.length > 0
      ? Math.round(
          chapter.sentences.reduce((sum, s) => sum + estimateRowHeight(s), 0) /
            chapter.sentences.length,
        )
      : 120;

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        data={chapter.sentences}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={averageEstimatedSize}
        overrideItemLayout={overrideItemLayout}
        getItemType={getRowItemType}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        extraData={{
          activeSentenceIndex,
          isImmersive,
          isPlaying,
          karaokeEnabled,
        }}
      />

      <SentenceActionPopover
        visible={popover !== null}
        sentence={popover?.sentence ?? null}
        anchorY={popover?.anchorY ?? 0}
        onBookmark={handleBookmark}
        onAskAi={handleAskAi}
        onDismiss={() => setPopover(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl * 2,
  },
});
