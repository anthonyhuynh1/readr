import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { BookCard } from '../components/BookCard';
import { theme } from '../constants/theme';
import { useCatalog } from '../context/CatalogContext';
import { useOpenBook } from '../hooks/useOpenBook';
import { canReadBook } from '../services/content/repository';

export function ExploreScreen() {
  const { books, isLoadingContent } = useCatalog();
  const openBook = useOpenBook();

  return (
    <ScreenShell style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Explore</Text>
        <Text style={styles.subheading}>Public domain classics with narration</Text>
      </View>

      {isLoadingContent ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <BookCard
                book={item}
                fullWidth
                showReadableBadge={canReadBook(item.slug)}
                onPress={() => openBook(item)}
              />
            </View>
          )}
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
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
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  row: {
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: theme.spacing.lg,
  },
  muted: {
    padding: theme.spacing.lg,
    color: theme.colors.dimmedText,
  },
});
