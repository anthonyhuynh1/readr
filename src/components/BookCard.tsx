import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookCoverImage } from './read/BookCoverImage';
import { theme } from '../constants/theme';
import type { Book } from '../types';

interface BookCardProps {
  book: Book;
  onPress: () => void;
  compact?: boolean;
  fullWidth?: boolean;
  showReadableBadge?: boolean;
}

export function BookCard({
  book,
  onPress,
  compact = false,
  fullWidth = false,
  showReadableBadge = false,
}: BookCardProps) {
  return (
    <Pressable
      style={[
        styles.card,
        compact && styles.cardCompact,
        fullWidth && styles.cardFullWidth,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.coverShell,
          compact && styles.coverShellCompact,
          fullWidth && styles.coverShellFullWidth,
        ]}
      >
        <BookCoverImage
          bookSlug={book.slug}
          title={book.title}
          fallbackUrl={book.coverImageUrl}
          size={compact ? 'small' : 'large'}
        />
        {showReadableBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Readable</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={styles.author} numberOfLines={1}>
        {book.author}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: theme.spacing.md,
  },
  cardCompact: {
    width: '100%',
    marginRight: 0,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  cardFullWidth: {
    width: '100%',
    marginRight: 0,
  },
  coverShell: {
    width: 140,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.colors.trueBlack,
    marginBottom: theme.spacing.sm,
  },
  coverShellCompact: {
    width: 56,
    height: 80,
    marginBottom: 0,
  },
  coverShellFullWidth: {
    width: '100%',
    height: 220,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.brandOrange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.trueBlack,
    lineHeight: 18,
  },
  author: {
    marginTop: 2,
    fontSize: 11,
    color: theme.colors.dimmedText,
  },
});
