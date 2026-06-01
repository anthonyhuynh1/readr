import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaybackSpeed } from '../../store/usePlaybackStore';
import { theme } from '../../constants/theme';

export type ReadViewMode = 'listen' | 'read';

interface ReadModeBarProps {
  mode: ReadViewMode;
  playbackRate: PlaybackSpeed;
  onModeChange: (mode: ReadViewMode) => void;
  onOpenSpeedPicker: () => void;
  dark?: boolean;
}

export function ReadModeBar({
  mode,
  playbackRate,
  onModeChange,
  onOpenSpeedPicker,
  dark = false,
}: ReadModeBarProps) {
  const speedLabel =
    playbackRate === 1 ? '1x speed' : `${playbackRate}x speed`;

  return (
    <View style={[styles.bar, dark && styles.barDark]}>
      <View style={[styles.toggle, dark && styles.toggleDark]}>
        <Pressable
          style={[styles.toggleBtn, mode === 'listen' && styles.toggleBtnActive]}
          onPress={() => onModeChange('listen')}
        >
          <Text
            style={[
              styles.toggleText,
              dark && styles.toggleTextDark,
              mode === 'listen' && styles.toggleTextActive,
            ]}
          >
            ♪ Listen
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, mode === 'read' && styles.toggleBtnActive]}
          onPress={() => onModeChange('read')}
        >
          <Text
            style={[
              styles.toggleText,
              dark && styles.toggleTextDark,
              mode === 'read' && styles.toggleTextActive,
            ]}
          >
            ☰ Read
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.speedPill, dark && styles.speedPillDark]}
        onPress={onOpenSpeedPicker}
      >
        <Text style={[styles.speedText, dark && styles.speedTextDark]}>{speedLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  barDark: {},
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 24,
    padding: 4,
  },
  toggleDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  toggleBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.trueBlack,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.trueBlack,
  },
  toggleTextDark: {
    color: 'rgba(255,255,255,0.85)',
  },
  toggleTextActive: {
    color: theme.colors.white,
  },
  speedPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  speedPillDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  speedText: {
    fontSize: 13,
    color: theme.colors.dimmedText,
    fontWeight: '500',
  },
  speedTextDark: {
    color: 'rgba(255,255,255,0.65)',
  },
});
