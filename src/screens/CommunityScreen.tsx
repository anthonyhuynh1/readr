import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { theme } from '../constants/theme';

export function CommunityScreen() {
  return (
    <ScreenShell style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.heading}>Community</Text>
        <Text style={styles.subheading}>Discuss books, share highlights, and follow readers.</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Coming soon</Text>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.trueBlack,
  },
  subheading: {
    marginTop: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.dimmedText,
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.dimmedText,
  },
});
