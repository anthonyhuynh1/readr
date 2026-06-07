import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Called with the word's window-Y when tapped. */
  onPress: (anchorY: number) => void;
  /** Called with the word's window-Y when long-pressed. */
  onLongPress?: (anchorY: number) => void;
}

function estimateWordWidth(label: string): number {
  return Math.max(8, label.length * 10);
}

/**
 * Dual-layer word: base text with an orange overlay clipped to playback progress.
 * All math inside useAnimatedStyle is inlined — no JS-thread helpers (iOS crash).
 */
export const KaraokeWord = memo(function KaraokeWord({
  word,
  isKaraokeActive,
  trailingSpace,
  onPress,
  onLongPress,
}: KaraokeWordProps) {
  const pressableRef = useRef<View>(null);
  const { progressMs } = usePlaybackProgress();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const suffix = trailingSpace ? ' ' : '';
  const label = `${word.word}${suffix}`;
  const startMs = word.start_ms;
  const endMs = word.end_ms;
  const fallbackWidth = useMemo(() => estimateWordWidth(label), [label]);
  const clipBasisWidth = measuredWidth > 0 ? measuredWidth : fallbackWidth;

  useEffect(() => {
    setMeasuredWidth(0);
  }, [word.index, startMs, endMs, word.word]);

  const handlePress = useCallback(() => {
    pressableRef.current?.measureInWindow((_x, y) => {
      onPress(y);
    });
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    if (!onLongPress) return;
    pressableRef.current?.measureInWindow((_x, y) => {
      onLongPress(y);
    });
  }, [onLongPress]);

  const clipStyle = useAnimatedStyle(() => {
    if (!isKaraokeActive) {
      return { width: 0 };
    }
    const timeMs = progressMs.value;
    let fill = 0;
    if (timeMs >= endMs) {
      fill = 1;
    } else if (timeMs > startMs) {
      const duration = endMs - startMs;
      fill = duration > 0 ? (timeMs - startMs) / duration : 1;
    }
    return { width: clipBasisWidth * fill };
  }, [isKaraokeActive, clipBasisWidth, startMs, endMs]);

  return (
    <Pressable
      ref={pressableRef as React.RefObject<View>}
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={350}
      hitSlop={4}
      style={styles.hit}
    >
      <View
        style={styles.wordShell}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next > 0 && Math.abs(next - measuredWidth) > 0.5) {
            setMeasuredWidth(next);
          }
        }}
      >
        <Text style={styles.base}>{label}</Text>
        {isKaraokeActive ? (
          <Animated.View style={[styles.clip, clipStyle]}>
            <Text style={[styles.base, styles.sung, { width: clipBasisWidth }]}>
              {label}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Pressable>
  );
});

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
