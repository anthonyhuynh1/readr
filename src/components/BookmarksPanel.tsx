import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { usePlayback } from '../context/PlaybackContext';
import { useBookmarks } from '../context/BookmarkContext';
import { groupBookmarks } from '../utils/bookmarks';


interface BookmarksPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function BookmarksPanel({ visible, onClose }: BookmarksPanelProps) {
  const { book, jumpToBookmark } = usePlayback();
  const { bookmarks, removeBookmark } = useBookmarks();
  const groups = groupBookmarks(book, bookmarks);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.panelBackdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <Text style={styles.panelTitle}>Bookmarks</Text>

          {bookmarks.length === 0 ? (
            <Text style={styles.panelEmpty}>
              Long-press any sentence to bookmark a quote or ask AI about it.
            </Text>
          ) : (
            <ScrollView style={styles.panelList} showsVerticalScrollIndicator={false}>
              {groups.map((chapterGroup) => (
                <View key={chapterGroup.chapterSlug} style={styles.chapterBlock}>
                  <Text style={styles.chapterHeading}>{chapterGroup.chapterTitle}</Text>
                  {chapterGroup.pages.map((pageGroup) => (
                    <View key={`${chapterGroup.chapterSlug}-p-${pageGroup.pageNumber}`}>
                      <Text style={styles.pageHeading}>Page {pageGroup.pageNumber}</Text>
                      {pageGroup.bookmarks.map((bookmark) => (
                        <View key={bookmark.id} style={styles.bookmarkRow}>
                          <Pressable
                            style={styles.bookmarkTap}
                            onPress={() => {
                              void jumpToBookmark(bookmark.id);
                              onClose();
                            }}
                          >
                            <Text style={styles.bookmarkQuote}>{bookmark.text_preview}</Text>
                            {bookmark.pending_sync ? (
                              <Text style={styles.pendingSync}>Syncing…</Text>
                            ) : null}
                          </Pressable>
                          <Pressable
                            onPress={() => void removeBookmark(bookmark.id)}
                            hitSlop={8}
                          >
                            <Text style={styles.removeText}>×</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  card: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: theme.colors.trueBlack,
    borderRadius: 10,
    minWidth: 220,
    overflow: 'hidden',
  },
  action: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  actionText: {
    color: theme.colors.white,
    fontSize: 15,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  panelBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    maxHeight: '62%',
  },
  panelTitle: {
    fontSize: 13,
    letterSpacing: 1.2,
    fontWeight: '500',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
  },
  panelEmpty: {
    fontSize: 14,
    color: theme.colors.dimmedText,
    lineHeight: 22,
  },
  panelList: {
    maxHeight: 360,
  },
  chapterBlock: {
    marginBottom: theme.spacing.lg,
  },
  chapterHeading: {
    fontSize: 12,
    letterSpacing: 0.8,
    fontWeight: '600',
    color: theme.colors.trueBlack,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  pageHeading: {
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
  },
  bookmarkTap: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  bookmarkQuote: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.trueBlack,
  },
  pendingSync: {
    marginTop: 4,
    fontSize: 11,
    color: theme.colors.brandOrange,
  },
  removeText: {
    fontSize: 22,
    color: theme.colors.dimmedText,
    paddingHorizontal: theme.spacing.sm,
  },
});
