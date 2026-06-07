import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { theme } from '../../constants/theme';

interface ReturnToSyncBtnProps {
  onPress: () => void;
  visible: boolean;
  direction: 'up' | 'down';
}

/**
 * A floating button that appears when the user manually scrolls away
 * from the active playing sentence. Clicking it resumes autoscroll.
 */
export function ReturnToSyncBtn({ onPress, visible, direction }: ReturnToSyncBtnProps) {
  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={onPress}
        hitSlop={8}
      >
        <Text style={styles.btnIcon}>{direction === 'up' ? '↑' : '↓'}</Text>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    transform: [{ scale: 0.95 }],
  },
  btnIcon: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
});
