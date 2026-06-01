import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import type { Book, Chapter } from '../../types';
import { formatChapterDuration } from '../../utils/formatTime';

interface ChapterTOCModalProps {
  visible: boolean;
  book: Book;
  currentChapterSlug: string;
  onSelectChapter: (chapterSlug: string) => void;
  onClose: () => void;
}

export function ChapterTOCModal({
  visible,
  book,
  currentChapterSlug,
  onSelectChapter,
  onClose,
}: ChapterTOCModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Chapters</Text>
          <Text style={styles.subtitle}>{book.title}</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {book.chapters.map((chapter: Chapter) => {
              const isActive = chapter.slug === currentChapterSlug;
              return (
                <Pressable
                  key={chapter.slug}
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => {
                    onSelectChapter(chapter.slug);
                    onClose();
                  }}
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.chapterNum, isActive && styles.textActive]}>
                      {chapter.chapterIndex}
                    </Text>
                    <View style={styles.rowText}>
                      <Text style={[styles.chapterTitle, isActive && styles.textActive]}>
                        {chapter.title}
                      </Text>
                      <Text style={styles.chapterDuration}>
                        {formatChapterDuration(chapter.durationMs)}
                      </Text>
                    </View>
                  </View>
                  {isActive ? <Text style={styles.nowPlaying}>Now playing</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    maxHeight: '72%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.trueBlack,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.md,
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowActive: {
    backgroundColor: 'rgba(255, 107, 0, 0.06)',
    marginHorizontal: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  chapterNum: {
    width: 28,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.dimmedText,
  },
  rowText: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.trueBlack,
  },
  chapterDuration: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.dimmedText,
  },
  textActive: {
    color: theme.colors.brandOrange,
  },
  nowPlaying: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.brandOrange,
    fontWeight: '600',
  },
});
