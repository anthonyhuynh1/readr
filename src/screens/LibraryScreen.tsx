import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { theme } from '../constants/theme';
import { useCatalog } from '../context/CatalogContext';
import { useBookmarks } from '../context/BookmarkContext';
import { useOpenBook } from '../hooks/useOpenBook';
import { groupBookmarks } from '../utils/bookmarks';

export function LibraryScreen() {
  const { books } = useCatalog();
  const { bookmarks } = useBookmarks();
  const openBook = useOpenBook();

  const bookmarkGroups = useMemo(() => {
    const byBook = new Map<string, ReturnType<typeof groupBookmarks>>();
    for (const book of books) {
      const bookMarks = bookmarks.filter((b) => b.book_slug === book.slug);
      if (bookMarks.length > 0) {
        byBook.set(book.slug, groupBookmarks(book, bookMarks));
      }
    }
    return byBook;
  }, [books, bookmarks]);

  const savedBooks = books.filter((b) => bookmarkGroups.has(b.slug));

  return (
    <ScreenShell style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Library</Text>
        <Text style={styles.subheading}>Your saved books and bookmarks</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your books</Text>
          {savedBooks.length === 0 ? (
            <Text style={styles.muted}>
              Books you bookmark will appear here. Open a title from Explore to get started.
            </Text>
          ) : (
            savedBooks.map((book) => (
              <Pressable
                key={book.slug}
                style={styles.bookRow}
                onPress={() => openBook(book)}
              >
                <Text style={styles.bookTitle}>{book.title}</Text>
                <Text style={styles.bookMeta}>{book.author}</Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All titles</Text>
          {books.map((book) => (
            <Pressable
              key={book.slug}
              style={styles.bookRow}
              onPress={() => openBook(book)}
            >
              <Text style={styles.bookTitle}>{book.title}</Text>
              <Text style={styles.bookMeta}>{book.author}</Text>
            </Pressable>
          ))}
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
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.trueBlack,
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
    marginBottom: theme.spacing.md,
  },
  bookRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.trueBlack,
  },
  bookMeta: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.dimmedText,
  },
  muted: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.dimmedText,
  },
});
