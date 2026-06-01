import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../constants/theme';

interface ChapterTitleButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'header' | 'inline';
}

export function ChapterTitleButton({
  title,
  onPress,
  loading = false,
  variant = 'header',
}: ChapterTitleButtonProps) {
  return (
    <Pressable
      style={[styles.root, variant === 'inline' && styles.rootInline]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Open chapter list`}
      hitSlop={8}
    >
      <Text
        style={[styles.title, variant === 'inline' && styles.titleInline]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.brandOrange} />
      ) : (
        <Text style={[styles.chevron, variant === 'inline' && styles.chevronInline]}>▾</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 8,
    maxWidth: '100%',
  },
  rootInline: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  title: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.trueBlack,
  },
  titleInline: {
    textAlign: 'left',
    fontSize: 14,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 12,
    color: theme.colors.dimmedText,
    marginTop: 1,
  },
  chevronInline: {
    fontSize: 11,
  },
});
