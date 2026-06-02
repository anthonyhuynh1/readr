import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { usePlaybackProgress } from '../store/ProgressProvider';
import type { WordTimestamp } from '../types';
import { getWordFillProgress } from '../utils/karaoke';

interface KaraokeWordProps {
  word: WordTimestamp;
  /** When true, applies fluid karaoke fill driven by playback progress. */
  isKaraokeActive: boolean;
  trailingSpace: boolean;
  onPress: () => void;
}

function estimateWordWidth(label: string): number {
  return Math.max(8, label.length * 10);
}

/**
 * Dual-layer word: base text with an orange overlay clipped to playback progress.
 * Progress reads from a Reanimated SharedValue to avoid React re-renders at 60 Hz.
 */
export function KaraokeWord({
  word,
  isKaraokeActive,
  trailingSpace,
  onPress,
}: KaraokeWordProps) {
  const { progressMs } = usePlaybackProgress();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const suffix = trailingSpace ? ' ' : '';
  const label = `${word.word}${suffix}`;

  const clipStyle = useAnimatedStyle(() => {
    if (!isKaraokeActive) {
      return { width: 0 };
    }

    const fill = getWordFillProgress(progressMs.value, word);
    const width = measuredWidth > 0 ? measuredWidth : estimateWordWidth(label);
    return { width: width * fill };
  }, [isKaraokeActive, measuredWidth, label, word.start_ms, word.end_ms]);

  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.hit}>
      <View
        style={styles.wordShell}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next > 0) setMeasuredWidth(next);
        }}
      >
        <Text style={styles.base}>{label}</Text>
        {isKaraokeActive && (
          <Animated.View style={[styles.clip, clipStyle]}>
            <Text style={[styles.base, styles.sung, { width: measuredWidth || estimateWordWidth(label) }]}>
              {label}
            </Text>
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    flexShrink: 1,
  },
  wordShell: {
    position: 'relative',
  },
  base: {
    fontSize: theme.typography.reader.fontSize,
    lineHeight: theme.typography.reader.lineHeight,
    letterSpacing: theme.typography.reader.letterSpacing,
    color: theme.colors.activeText,
  },
  sung: {
    color: theme.colors.brandOrange,
  },
  clip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
});
