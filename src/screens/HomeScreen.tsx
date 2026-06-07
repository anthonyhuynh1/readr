import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { BookCard } from '../components/BookCard';
import { theme } from '../constants/theme';
import { useCatalog } from '../context/CatalogContext';
import { useOpenBook } from '../hooks/useOpenBook';
import { canReadBook } from '../services/content/repository';

export function HomeScreen() {
  const { books, isLoadingContent } = useCatalog();
  const openBook = useOpenBook();

  const featured = books.slice(0, 3);
  const continueReading = books.find((b) => canReadBook(b.slug)) ?? books[0];

  return (
    <ScreenShell style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Readr</Text>
        <Text style={styles.subheading}>Listen and read in sync</Text>

        {continueReading ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue</Text>
            <BookCard
              book={continueReading}
              compact
              showReadableBadge={canReadBook(continueReading.slug)}
              onPress={() => openBook(continueReading)}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured</Text>
          {isLoadingContent ? (
            <Text style={styles.muted}>Loading catalog…</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {featured.map((book) => (
                <BookCard
                  key={book.slug}
                  book={book}
                  showReadableBadge={canReadBook(book.slug)}
                  onPress={() => openBook(book)}
                />
              ))}
            </ScrollView>
          )}
        </View>
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
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.trueBlack,
    letterSpacing: -0.5,
  },
  subheading: {
    marginTop: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.md,
  },
  muted: {
    color: theme.colors.dimmedText,
    fontSize: 14,
  },
});
