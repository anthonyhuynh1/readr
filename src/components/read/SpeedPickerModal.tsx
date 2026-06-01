import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PLAYBACK_SPEED_OPTIONS,
  type PlaybackSpeed,
} from '../../store/usePlaybackStore';
import { theme } from '../../constants/theme';

interface SpeedPickerModalProps {
  visible: boolean;
  currentRate: PlaybackSpeed;
  onSelect: (rate: PlaybackSpeed) => void;
  onClose: () => void;
}

export function SpeedPickerModal({
  visible,
  currentRate,
  onSelect,
  onClose,
}: SpeedPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Playback speed</Text>

          {PLAYBACK_SPEED_OPTIONS.map((rate) => {
            const isActive = rate === currentRate;
            return (
              <Pressable
                key={rate}
                style={[styles.row, isActive && styles.rowActive]}
                onPress={() => {
                  onSelect(rate);
                  onClose();
                }}
              >
                <Text style={[styles.rowLabel, isActive && styles.rowLabelActive]}>
                  {rate === 1 ? '1x (Normal)' : `${rate}x`}
                </Text>
                {isActive ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowActive: {
    backgroundColor: 'rgba(255, 107, 0, 0.06)',
    marginHorizontal: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 8,
  },
  rowLabel: {
    fontSize: 16,
    color: theme.colors.trueBlack,
  },
  rowLabelActive: {
    color: theme.colors.brandOrange,
    fontWeight: '600',
  },
  check: {
    fontSize: 16,
    color: theme.colors.brandOrange,
    fontWeight: '700',
  },
});
