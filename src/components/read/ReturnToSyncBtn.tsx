import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { theme } from '../../constants/theme';

interface ReturnToSyncBtnProps {
  onPress: () => void;
  visible: boolean;
}

/**
 * A floating button that appears when the user manually scrolls away
 * from the active playing sentence. Clicking it resumes autoscroll.
 */
export function ReturnToSyncBtn({ onPress, visible }: ReturnToSyncBtnProps) {
  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={onPress}
        hitSlop={8}
      >
        <Text style={styles.btnText}>↓ Return to sync</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 50,
  },
  btn: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    transform: [{ scale: 0.98 }],
  },
  btnText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
