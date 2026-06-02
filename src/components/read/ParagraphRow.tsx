import React, { memo, useCallback, useMemo, useRef } from 'react';

import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { theme } from '../../constants/theme';

import { useCoarseSyncTime } from '../../hooks/useCoarseSyncTime';

import { useLongPress } from '../../hooks/useLongPress';

import type { Sentence, WordTimestamp } from '../../types';

import { findActiveWordIndexInSentence } from '../../utils/karaoke';

import {

  buildParagraphSentenceSpans,

  findActiveSpanIndex,

  KARAOKE_WORD_SPAN_FALLBACK_THRESHOLD,

  type ParagraphSentenceSpan,

  wordsForSpan,

} from '../../utils/paragraphSentences';

import { KaraokeWord } from '../KaraokeWord';



interface ParagraphRowProps {

  sentence: Sentence;

  isActiveSentence: boolean;

  isImmersive: boolean;

  isPlaying: boolean;

  /** Word-level karaoke map — only true for the active row while audio is playing. */

  showWordKaraoke: boolean;

  onSpanSeek: (startMs: number) => void;

  onSentenceLongPress: (sentence: Sentence, anchorY: number) => void;

  onLayout?: (height: number) => void;

}



function useParagraphSpans(sentence: Sentence) {

  return useMemo(

    () => buildParagraphSentenceSpans(sentence.words),

    [sentence.words],

  );

}



interface SentenceSpanTextProps {

  span: ParagraphSentenceSpan;

  spanIndex: number;

  activeSpanIndex: number;

  isActiveBlock: boolean;

  isImmersive: boolean;

  onPress: (span: ParagraphSentenceSpan) => void;

}



const SentenceSpanText = memo(function SentenceSpanText({

  span,

  spanIndex,

  activeSpanIndex,

  isActiveBlock,

  isImmersive,

  onPress,

}: SentenceSpanTextProps) {

  const isPast = isActiveBlock && spanIndex < activeSpanIndex;

  const isCurrent = isActiveBlock && spanIndex === activeSpanIndex;



  const handlePress = useCallback(() => {

    onPress(span);

  }, [onPress, span]);



  return (

    <Pressable onPress={handlePress} hitSlop={4}>

      <Text

        style={[

          styles.readerText,

          isPast && styles.sung,

          isCurrent && isImmersive && styles.activeSpan,

        ]}

      >

        {span.text}{' '}

      </Text>

    </Pressable>

  );

});



/** Static paragraph — sentence spans, no sync clock. */

const StaticParagraphRow = memo(function StaticParagraphRow({

  sentence,

  isActiveSentence,

  isImmersive,

  onSpanSeek,

  onSentenceLongPress,

  onLayout,

}: Omit<ParagraphRowProps, 'showWordKaraoke' | 'isPlaying'>) {

  const rowRef = useRef<View>(null);
  const spans = useParagraphSpans(sentence);
  const syncTimeMs = useCoarseSyncTime(isActiveSentence ? 100 : 500);
  const activeSpanIndex = useMemo(
    () => (isActiveSentence ? findActiveSpanIndex(spans, syncTimeMs) : -1),
    [isActiveSentence, spans, syncTimeMs],
  );

  const handleLongPress = useCallback(() => {

    rowRef.current?.measureInWindow((_x, y) => {

      onSentenceLongPress(sentence, y);

    });

  }, [onSentenceLongPress, sentence]);



  const longPress = useLongPress({ onLongPress: handleLongPress });



  const handleSpanPress = useCallback(

    (span: ParagraphSentenceSpan) => {

      if (longPress.consumeIfTriggered()) return;

      onSpanSeek(span.start_ms);

    },

    [longPress, onSpanSeek],

  );



  const opacity = isImmersive

    ? isActiveSentence

      ? theme.opacity.active

      : theme.opacity.dimmed

    : theme.opacity.active;



  const handleLayout = useCallback(

    (event: LayoutChangeEvent) => {

      onLayout?.(event.nativeEvent.layout.height);

    },

    [onLayout],

  );



  return (

    <View

      ref={rowRef}

      style={[

        styles.paragraph,

        isActiveSentence && isImmersive && styles.activeBlock,

        { opacity },

      ]}

      onLayout={handleLayout}

      onTouchStart={longPress.onTouchStart}

      onTouchMove={longPress.onTouchMove}

      onTouchEnd={longPress.onTouchEnd}

      onTouchCancel={longPress.onTouchCancel}

    >

      <View style={styles.sentenceRow}>

        {spans.map((span, si) => (

          <SentenceSpanText

            key={`${sentence.id}-span-${si}`}

            span={span}

            spanIndex={si}

            activeSpanIndex={activeSpanIndex}

            isActiveBlock={isActiveSentence}

            isImmersive={isImmersive}

            onPress={handleSpanPress}

          />

        ))}

      </View>

    </View>

  );

});



/** Active row during playback — word karaoke scoped to the active grammatical sentence. */

const ActiveKaraokeParagraphRow = memo(function ActiveKaraokeParagraphRow({

  sentence,

  isImmersive,

  isPlaying,

  onSpanSeek,

  onSentenceLongPress,

  onLayout,

}: Omit<ParagraphRowProps, 'showWordKaraoke' | 'isActiveSentence'>) {

  const rowRef = useRef<View>(null);

  const syncTimeMs = useCoarseSyncTime(100);

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



  const useSolidFallback =

    activeSpanWords.length > KARAOKE_WORD_SPAN_FALLBACK_THRESHOLD;



  const handleLongPress = useCallback(() => {

    rowRef.current?.measureInWindow((_x, y) => {

      onSentenceLongPress(sentence, y);

    });

  }, [onSentenceLongPress, sentence]);



  const longPress = useLongPress({ onLongPress: handleLongPress });



  const handleSpanPress = useCallback(

    (span: ParagraphSentenceSpan) => {

      if (longPress.consumeIfTriggered()) return;

      onSpanSeek(span.start_ms);

    },

    [longPress, onSpanSeek],

  );



  const handleLayout = useCallback(

    (event: LayoutChangeEvent) => {

      onLayout?.(event.nativeEvent.layout.height);

    },

    [onLayout],

  );



  const isKaraokeActive = isImmersive && isPlaying;



  const renderWord = useCallback(

    (word: WordTimestamp, wi: number, spanKey: string) => {

      const suffix = wi < activeSpanWords.length - 1 ? ' ' : '';

      const isPast = wi < activeWordIndexInSpan;

      const isCurrent = wi === activeWordIndexInSpan;

      const key = `${spanKey}-w-${word.index}`;



      const onPress = () => handleSpanPress(activeSpan!);



      if (isCurrent && useSolidFallback) {

        return (

          <Pressable key={key} onPress={onPress} hitSlop={4} style={styles.wordHit}>

            <Text style={[styles.readerText, styles.sung]}>{`${word.word}${suffix}`}</Text>

          </Pressable>

        );

      }



      if (isCurrent) {

        return (

          <KaraokeWord

            key={key}

            word={word}

            isKaraokeActive={isKaraokeActive}

            trailingSpace={wi < activeSpanWords.length - 1}

            onPress={onPress}

          />

        );

      }



      return (

        <Pressable key={key} onPress={onPress} hitSlop={4} style={styles.wordHit}>

          <Text style={[styles.readerText, isPast && styles.sung]}>

            {`${word.word}${suffix}`}

          </Text>

        </Pressable>

      );

    },

    [

      activeSpan,

      activeSpanWords.length,

      activeWordIndexInSpan,

      handleSpanPress,

      isKaraokeActive,

      useSolidFallback,

    ],

  );



  return (

    <View

      ref={rowRef}

      style={[styles.paragraph, styles.activeBlock, { opacity: theme.opacity.active }]}

      onLayout={handleLayout}

      onTouchStart={longPress.onTouchStart}

      onTouchMove={longPress.onTouchMove}

      onTouchEnd={longPress.onTouchEnd}

      onTouchCancel={longPress.onTouchCancel}

    >

      <View style={styles.sentenceRow}>

        {spans.map((span, si) => {

          if (si === activeSpanIndex) {

            const spanWords = wordsForSpan(sentence.words, span);

            return (

              <View key={`${sentence.id}-karaoke-${si}`} style={styles.inlineSpan}>

                {spanWords.map((word, wi) =>

                  renderWord(word, wi, `${sentence.id}-karaoke-${si}`),

                )}

              </View>

            );

          }



          return (

            <SentenceSpanText

              key={`${sentence.id}-span-${si}`}

              span={span}

              spanIndex={si}

              activeSpanIndex={activeSpanIndex}

              isActiveBlock

              isImmersive={isImmersive}

              onPress={handleSpanPress}

            />

          );

        })}

      </View>

    </View>

  );

});



export const ParagraphRow = memo(function ParagraphRow(props: ParagraphRowProps) {

  if (props.showWordKaraoke) {

    return <ActiveKaraokeParagraphRow {...props} />;

  }

  return <StaticParagraphRow {...props} />;

});



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


