import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { usePlaybackSession } from '../../context/PlaybackContext';
import { useCoarseSyncTime } from '../../hooks/useCoarseSyncTime';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { formatPlaybackTime } from '../../utils/formatTime';
import { PlaybackProgressBar } from './PlaybackProgressBar';

interface PlaybackTransportProps {
  /** Show skip-15 controls alongside play (read footer style). */
  compact?: boolean;
  /** Dark immersive styling for read mode when playing. */
  dark?: boolean;
}

export function PlaybackTransport({ compact = false, dark = false }: PlaybackTransportProps) {
  const { togglePlay, chapter, audioDurationMs, skipBack15, skipForward15, audioError } =
    usePlaybackSession();
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const syncTimeMs = useCoarseSyncTime(50);

  const durationMs = Math.max(chapter.durationMs, audioDurationMs, 1);
  const remainingMs = Math.max(0, durationMs - syncTimeMs);

  const timeStyle = dark ? styles.timeDark : styles.time;
  const isDarkBar = dark;

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <PlaybackProgressBar variant={isDarkBar ? 'dark' : 'light'} />

      <View style={styles.controlsRow}>
        <Text style={timeStyle}>{formatPlaybackTime(syncTimeMs)}</Text>

        {compact ? (
          <View style={styles.compactControls}>
            <Pressable onPress={() => void skipBack15()} hitSlop={8}>
              <Text style={[styles.skipLabel, dark && styles.skipLabelDark]}>↺15</Text>
            </Pressable>
            <Pressable
              style={[styles.playButton, dark && styles.playButtonDark]}
              onPress={() => void togglePlay()}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
              <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
            </Pressable>
            <Pressable onPress={() => void skipForward15()} hitSlop={8}>
              <Text style={[styles.skipLabel, dark && styles.skipLabelDark]}>15↻</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.playButton}
            onPress={() => void togglePlay()}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
          </Pressable>
        )}

        <Text style={[timeStyle, styles.timeRight]}>{formatPlaybackTime(remainingMs)}</Text>
      </View>

      {audioError ? <Text style={styles.error}>{audioError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  rootCompact: {
    paddingTop: theme.spacing.xs,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  skipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.dimmedText,
  },
  skipLabelDark: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  time: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.trueBlack,
    letterSpacing: theme.typography.caption.letterSpacing,
    minWidth: 48,
    fontVariant: ['tabular-nums'],
  },
  timeDark: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  timeRight: {
    textAlign: 'right',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDark: {
    backgroundColor: theme.colors.brandOrange,
  },
  playIcon: {
    color: theme.colors.white,
    fontSize: 16,
    marginLeft: 2,
  },
  error: {
    color: '#b00020',
    fontSize: 12,
    textAlign: 'center',
  },
});
