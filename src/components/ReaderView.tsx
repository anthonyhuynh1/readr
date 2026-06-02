import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { theme } from '../constants/theme';
import { usePlaybackSession } from '../context/PlaybackContext';
import { useLongPress } from '../hooks/useLongPress';
import { useSyncEngine } from '../hooks/useSyncEngine';
import type { Sentence, WordTimestamp } from '../types';
import { SentenceActionPopover } from './BookmarksPanel';
import { KaraokeWord } from './KaraokeWord';

interface SentenceRowProps {
  sentence: Sentence;
  isActiveSentence: boolean;
  isImmersive: boolean;
  karaokeWords: boolean;
  onWordPress: (word: WordTimestamp) => void;
  onSentenceLongPress: (sentence: Sentence, anchorY: number) => void;
}

const SentenceRow = memo(function SentenceRow({
  sentence,
  isActiveSentence,
  isImmersive,
  karaokeWords,
  onWordPress,
  onSentenceLongPress,
}: SentenceRowProps) {
  const rowRef = useRef<View>(null);

  const handleLongPress = useCallback(() => {
    rowRef.current?.measureInWindow((_x, y) => {
      onSentenceLongPress(sentence, y);
    });
  }, [onSentenceLongPress, sentence]);

  const longPress = useLongPress({ onLongPress: handleLongPress });

  const opacity = isImmersive
    ? isActiveSentence
      ? theme.opacity.active
      : theme.opacity.dimmed
    : theme.opacity.active;

  return (
    <View
      ref={rowRef}
      style={[styles.paragraph, { opacity }]}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onTouchCancel={longPress.onTouchCancel}
    >
      {karaokeWords ? (
        <View style={styles.sentenceRow}>
          {sentence.words.map((word, wi) => (
            <KaraokeWord
              key={`${sentence.id}-w-${word.index}`}
              word={word}
              isKaraokeActive={isImmersive}
              trailingSpace={wi < sentence.words.length - 1}
              onPress={() => {
                if (longPress.consumeIfTriggered()) return;
                onWordPress(word);
              }}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.readerText}>{sentence.text}</Text>
      )}
    </View>
  );
});

export function ReaderView() {
  const scrollRef = useRef<ScrollView>(null);
  const sentenceLayouts = useRef<Record<number, number>>({});

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

  const { sentenceIndex: activeSentenceIndex } = useSyncEngine();

  const karaokeEnabled = !audioError && isImmersive;

  const [popover, setPopover] = useState<{
    sentence: Sentence;
    anchorY: number;
  } | null>(null);

  const handleWordPress = useCallback(
    (word: WordTimestamp) => {
      seekToWord(word.start_ms);
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

  const handleSentenceLayout = useCallback((index: number, y: number) => {
    sentenceLayouts.current[index] = y;
  }, []);

  const scrollToSentence = useCallback((index: number) => {
    const y = sentenceLayouts.current[index];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    }
  }, []);

  useEffect(() => {
    if (activeSentenceIndex < 0 || !isImmersive) return;
    scrollToSentence(activeSentenceIndex);
  }, [activeSentenceIndex, isImmersive, scrollToSentence]);

  useEffect(() => {
    if (scrollToSentenceIndex === null) return;
    scrollToSentence(scrollToSentenceIndex);
    clearScrollTarget();
  }, [scrollToSentenceIndex, scrollToSentence, clearScrollTarget]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {chapter.sentences.map((sentence, si) => (
          <View
            key={sentence.id}
            onLayout={(e: LayoutChangeEvent) =>
              handleSentenceLayout(si, e.nativeEvent.layout.y)
            }
          >
            <SentenceRow
              sentence={sentence}
              isActiveSentence={si === activeSentenceIndex}
              isImmersive={isImmersive}
              karaokeWords={karaokeEnabled && si === activeSentenceIndex}
              onWordPress={handleWordPress}
              onSentenceLongPress={handleSentenceLongPress}
            />
          </View>
        ))}
      </ScrollView>

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
  paragraph: {
    marginBottom: theme.spacing.lg,
  },
  sentenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  readerText: {
    fontSize: theme.typography.reader.fontSize,
    lineHeight: theme.typography.reader.lineHeight,
    letterSpacing: theme.typography.reader.letterSpacing,
    color: theme.colors.activeText,
  },
});
