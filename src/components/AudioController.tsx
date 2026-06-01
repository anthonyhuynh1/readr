import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { usePlaybackSession } from '../context/PlaybackContext';
import { useCoarseSyncTime } from '../hooks/useCoarseSyncTime';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { formatPlaybackTime } from '../utils/formatTime';

interface AudioControllerProps {
  compact?: boolean;
}

export function AudioController({ compact = false }: AudioControllerProps) {
  const { togglePlay, chapter, audioDurationMs, skipBack15, skipForward15 } =
    usePlaybackSession();

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const isImmersive = usePlaybackStore((s) => s.isImmersive);
  const syncTimeMs = useCoarseSyncTime();
  const { activeSentence } = useSyncEngine();

  const durationMs = Math.max(chapter.durationMs, audioDurationMs, 1);
  const progress = useMemo(
    () => syncTimeMs / durationMs,
    [syncTimeMs, durationMs],
  );

  return (
    <View style={[styles.container, compact && styles.containerCompact, isImmersive && !compact && styles.containerImmersive]}>
      {!compact && isImmersive && activeSentence ? (
        <Text style={styles.nowReading} numberOfLines={1}>
          {activeSentence.text.slice(0, 60)}
          {activeSentence.text.length > 60 ? '…' : ''}
        </Text>
      ) : null}

      <View style={[styles.progressTrack, isImmersive && !compact && styles.progressTrackImmersive]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.controls}>
        <Text style={[styles.time, isImmersive && !compact && styles.timeDimmed]}>
          {formatPlaybackTime(syncTimeMs)}
        </Text>

        {compact ? (
          <View style={styles.compactControls}>
            <Pressable onPress={() => void skipBack15()} hitSlop={8}>
              <Text style={styles.compactSkip}>↺15</Text>
            </Pressable>
            <Pressable
              style={styles.playButton}
              onPress={() => void togglePlay()}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
              <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
            </Pressable>
            <Pressable onPress={() => void skipForward15()} hitSlop={8}>
              <Text style={styles.compactSkip}>15↻</Text>
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

        <Text style={[styles.time, isImmersive && !compact && styles.timeDimmed]}>
          {formatPlaybackTime(durationMs - syncTimeMs)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  containerCompact: {
    paddingHorizontal: 0,
    paddingTop: theme.spacing.sm,
    paddingBottom: 0,
    borderTopWidth: 0,
  },
  containerImmersive: {
    backgroundColor: theme.colors.trueBlack,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  nowReading: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    marginBottom: theme.spacing.sm,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  progressTrackImmersive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.brandOrange,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  compactSkip: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.dimmedText,
  },
  time: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.trueBlack,
    letterSpacing: theme.typography.caption.letterSpacing,
    minWidth: 48,
    fontVariant: ['tabular-nums'],
  },
  timeDimmed: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: theme.colors.white,
    fontSize: 16,
    marginLeft: 2,
  },
});
