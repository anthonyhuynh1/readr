import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getBookCoverColors, getBookCoverUrl } from '../../data/bookCovers';
import { theme } from '../../constants/theme';

interface BookCoverImageProps {
  bookSlug: string;
  title: string;
  fallbackUrl?: string;
  size?: 'large' | 'small';
}

function BookCoverImageInner({
  bookSlug,
  title,
  fallbackUrl,
  size = 'large',
}: BookCoverImageProps) {
  const [failed, setFailed] = useState(false);
  const uri = getBookCoverUrl(bookSlug, fallbackUrl);
  const colors = getBookCoverColors(bookSlug);
  const isLarge = size === 'large';

  if (!uri || failed) {
    return (
      <View
        style={[
          isLarge ? styles.largeFallback : styles.smallFallback,
          { backgroundColor: colors.bg },
        ]}
      >
        <Text style={[styles.fallbackLetter, { color: colors.accent }]}>
          {title.slice(0, 1).toUpperCase()}
        </Text>
        <Text style={[styles.fallbackTitle, { color: colors.accent }]} numberOfLines={3}>
          {title}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={isLarge ? styles.largeImage : styles.smallImage}
      onError={() => setFailed(true)}
    />
  );
}

export const BookCoverImage = React.memo(BookCoverImageInner);

const styles = StyleSheet.create({
  largeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  smallImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  largeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  smallFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
  },
  fallbackLetter: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },
});
