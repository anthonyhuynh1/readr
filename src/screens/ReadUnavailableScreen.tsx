import React, { useMemo } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenShell } from '../components/ScreenShell';
import { BookCard } from '../components/BookCard';
import { theme } from '../constants/theme';
import { usePlayback } from '../context/PlaybackContext';
import { useOpenBook } from '../hooks/useOpenBook';
import { canReadBook } from '../services/content/repository';
import type { RootStackParamList } from '../navigation/types';

type ReadUnavailableRoute = RouteProp<RootStackParamList, 'ReadUnavailable'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

async function openExternalUrl(url: string): Promise<void> {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
}

export function ReadUnavailableScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ReadUnavailableRoute>();
  const { title, author, standardEbooksUrl, openLibraryUrl } = route.params;

  const { books } = usePlayback();
  const openBook = useOpenBook();

  const readableNow = useMemo(
    () => books.filter((book) => canReadBook(book.slug)),
    [books],
  );

  const readableCount = readableNow.length;

  return (
    <ScreenShell style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.author}>by {author}</Text>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Not in Readr yet</Text>
          <Text style={styles.cardBody}>
            This title is in the catalog, but we have not ingested readable chapter text for it
            yet.
            {readableCount > 0
              ? ` You can read ${readableCount} ${readableCount === 1 ? 'title' : 'titles'} in Readr now (below).`
              : ' Check back after the next content update.'}
          </Text>

          {standardEbooksUrl ? (
            <Pressable
              style={styles.linkBtn}
              onPress={() => void openExternalUrl(standardEbooksUrl)}
            >
              <Text style={styles.linkBtnText}>Read on Standard Ebooks</Text>
            </Pressable>
          ) : null}

          {openLibraryUrl ? (
            <Pressable
              style={[styles.linkBtn, styles.linkBtnSecondary]}
              onPress={() => void openExternalUrl(openLibraryUrl)}
            >
              <Text style={[styles.linkBtnText, styles.linkBtnTextSecondary]}>
                View on Open Library
              </Text>
            </Pressable>
          ) : null}
        </View>

        {readableNow.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available in Readr</Text>
            {readableNow.map((book) => (
              <BookCard
                key={book.slug}
                book={book}
                fullWidth
                showReadableBadge
                onPress={() => openBook(book)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  backBtn: {
    marginBottom: theme.spacing.lg,
  },
  backText: {
    fontSize: 16,
    color: theme.colors.trueBlack,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.trueBlack,
  },
  author: {
    marginTop: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.xl,
  },
  card: {
    padding: theme.spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: '#f9f9f7',
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.sm,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.md,
  },
  linkBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 8,
    backgroundColor: theme.colors.trueBlack,
    alignItems: 'center',
  },
  linkBtnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  linkBtnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  linkBtnTextSecondary: {
    color: theme.colors.trueBlack,
  },
  section: {
    marginTop: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.md,
  },
});
