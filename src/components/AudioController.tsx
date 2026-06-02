import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { usePlaybackSession } from '../context/PlaybackContext';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { PlaybackTransport } from './read/PlaybackTransport';

interface AudioControllerProps {
  compact?: boolean;
}

/** Read-mode playback footer — delegates to shared PlaybackTransport. */
export function AudioController({ compact = false }: AudioControllerProps) {
  const { isImmersive } = usePlaybackStore();
  const { activeSentence } = useSyncEngine();
  const { audioError } = usePlaybackSession();
  const dark = isImmersive && !audioError;

  return (
    <View style={[styles.wrap, dark && !compact && styles.wrapDark]}>
      {dark && !compact && activeSentence ? (
        <Text style={styles.nowReading} numberOfLines={1}>
          {activeSentence.text.slice(0, 60)}
          {activeSentence.text.length > 60 ? '…' : ''}
        </Text>
      ) : null}
      <PlaybackTransport compact={compact} dark={dark && !compact} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.surface,
  },
  wrapDark: {
    backgroundColor: theme.colors.trueBlack,
    marginHorizontal: -theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  nowReading: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    marginBottom: theme.spacing.sm,
  },
});
