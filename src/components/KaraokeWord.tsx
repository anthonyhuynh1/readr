import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { usePlaybackProgress } from '../store/ProgressProvider';
import type { WordTimestamp } from '../types';

interface KaraokeWordProps {
  word: WordTimestamp;
  /** When true, applies fluid karaoke fill driven by playback progress. */
  isKaraokeActive: boolean;
  trailingSpace: boolean;
  onPress: () => void;
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
    if (!isKaraokeActive || measuredWidth <= 0) {
      return { width: 0 };
    }

    const timeMs = progressMs.value;
    let fill = 0;
    if (timeMs >= word.end_ms) fill = 1;
    else if (timeMs > word.start_ms) {
      const duration = word.end_ms - word.start_ms;
      fill = duration > 0 ? (timeMs - word.start_ms) / duration : 1;
    }

    return { width: measuredWidth * fill };
  }, [isKaraokeActive, measuredWidth, word.start_ms, word.end_ms]);

  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.hit}>
      <View
        style={styles.wordShell}
        onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      >
        <Text style={styles.base}>{label}</Text>
        {isKaraokeActive && measuredWidth > 0 && (
          <Animated.View style={[styles.clip, clipStyle]}>
            <Text style={[styles.base, styles.sung]}>{label}</Text>
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
