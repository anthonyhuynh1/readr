import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { usePlaybackSession } from '../../context/PlaybackContext';
import { usePlaybackProgress } from '../../store/ProgressProvider';

interface PlaybackProgressBarProps {
  variant?: 'light' | 'dark';
  onSeek?: (timeMs: number) => void;
}

export function PlaybackProgressBar({
  variant = 'light',
  onSeek,
}: PlaybackProgressBarProps) {
  const { progressMs } = usePlaybackProgress();
  const { chapter, audioDurationMs, seekTo } = usePlaybackSession();
  const lastWordEndMs = chapter.sentences.at(-1)?.words.at(-1)?.end_ms ?? 0;
  const durationMs = Math.max(chapter.durationMs, audioDurationMs, lastWordEndMs, 1);
  const durationSv = useSharedValue(durationMs);
  const trackWidth = useSharedValue(0);
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    durationSv.value = durationMs;
  }, [durationMs, durationSv]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      trackWidth.value = width;
      setLayoutWidth(width);
    },
    [trackWidth],
  );

  const fillStyle = useAnimatedStyle(() => {
    const total = Math.max(durationSv.value, 1);
    const ratio = Math.min(1, Math.max(0, progressMs.value / total));
    return {
      width: trackWidth.value * ratio,
    };
  });

  const handlePress = useCallback(
    (locationX: number) => {
      if (layoutWidth <= 0) return;
      const ratio = Math.min(1, Math.max(0, locationX / layoutWidth));
      const targetMs = ratio * durationMs;
      if (onSeek) {
        onSeek(targetMs);
      } else {
        void seekTo(targetMs);
      }
    },
    [durationMs, layoutWidth, onSeek, seekTo],
  );

  const isDark = variant === 'dark';

  return (
    <Pressable
      onPress={(event) => handlePress(event.nativeEvent.locationX)}
      accessibilityRole="adjustable"
      accessibilityLabel="Playback progress"
    >
      <View
        style={[styles.track, isDark && styles.trackDark]}
        onLayout={handleLayout}
      >
        <Animated.View
          style={[styles.fill, isDark && styles.fillDark, fillStyle]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 2,
  },
  fillDark: {
    backgroundColor: theme.colors.brandOrange,
  },
});
