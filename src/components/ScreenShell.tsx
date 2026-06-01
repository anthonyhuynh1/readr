import React, { type ReactNode } from 'react';
import { Platform, StatusBar, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type SafeAreaEdge = 'top' | 'bottom' | 'left' | 'right';

/** Top inset with Android fallback when the provider reports 0 (common on modal screens). */
export function resolveTopInset(measuredTop: number): number {
  if (measuredTop > 0) return measuredTop;
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? 28;
  }
  return 0;
}

export function useScreenInsets(edges: SafeAreaEdge[] = ['top', 'bottom']) {
  const insets = useSafeAreaInsets();

  return {
    paddingTop: edges.includes('top') ? resolveTopInset(insets.top) : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
}

interface ScreenShellProps {
  children: ReactNode;
  style?: ViewStyle;
  edges?: SafeAreaEdge[];
}

export function ScreenShell({
  children,
  style,
  edges = ['top', 'bottom'],
}: ScreenShellProps) {
  const padding = useScreenInsets(edges);

  return <View style={[styles.root, padding, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
