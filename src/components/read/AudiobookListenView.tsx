import React, { memo, useState } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenShell } from '../ScreenShell';
import { BookmarksPanel } from '../BookmarksPanel';
import { theme } from '../../constants/theme';
import { usePlaybackSession } from '../../context/PlaybackContext';
import {
  usePlaybackStore,
  type PlaybackSpeed,
} from '../../store/usePlaybackStore';
import { BookCoverImage } from './BookCoverImage';
import { ChapterTOCModal } from './ChapterTOCModal';
import { ChapterTitleButton } from './ChapterTitleButton';
import { PlaybackTransport } from './PlaybackTransport';
import { ReadModeBar, type ReadViewMode } from './ReadModeBar';
import { SpeedPickerModal } from './SpeedPickerModal';

interface AudiobookListenViewProps {
  onModeChange: (mode: ReadViewMode) => void;
  onBackToLibrary: () => void;
}

function IconButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.headerBtn} onPress={onPress} hitSlop={12}>
      <Text style={styles.headerBtnText}>{label}</Text>
    </Pressable>
  );
}

function AudiobookListenViewInner({
  onModeChange,
  onBackToLibrary,
}: AudiobookListenViewProps) {
  const {
    book,
    chapter,
    goToPrevChapter,
    goToNextChapter,
    selectChapter,
    setPlaybackRate: applyPlaybackRate,
    hasPrevChapter,
    hasNextChapter,
  } = usePlaybackSession();

  const isSwitchingChapter = usePlaybackStore((s) => s.isSwitchingChapter);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const setPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);

  const [showTOC, setShowTOC] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);

  const handleShare = async () => {
    await Share.share({
      message: `I'm listening to "${book.title}" by ${book.author} on Readr.`,
    });
  };

  const handleSpeedSelect = (rate: PlaybackSpeed) => {
    setPlaybackRate(rate);
    void applyPlaybackRate(rate);
  };

  return (
    <ScreenShell style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton label="←" onPress={onBackToLibrary} />
        <View style={styles.headerCenter}>
          <ChapterTitleButton
            title={chapter.title}
            onPress={() => setShowTOC(true)}
            loading={isSwitchingChapter}
          />
        </View>
        <View style={styles.headerRight}>
          <IconButton label="☑" onPress={() => setShowBookmarks(true)} />
          <IconButton label="↗" onPress={() => void handleShare()} />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.coverFrame}>
          <BookCoverImage
            bookSlug={book.slug}
            title={book.title}
            fallbackUrl={book.coverImageUrl}
          />
        </View>

        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>by {book.author}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.chapterSkipRow}>
          <Pressable
            style={[styles.chapterSkipBtn, !hasPrevChapter && styles.chapterSkipBtnDisabled]}
            onPress={() => void goToPrevChapter()}
            disabled={!hasPrevChapter}
          >
            <Text style={styles.chapterSkipText}>Previous chapter</Text>
          </Pressable>
          <Pressable
            style={[styles.chapterSkipBtn, !hasNextChapter && styles.chapterSkipBtnDisabled]}
            onPress={() => void goToNextChapter()}
            disabled={!hasNextChapter}
          >
            <Text style={styles.chapterSkipText}>Next chapter</Text>
          </Pressable>
        </View>

        <PlaybackTransport compact />

        <ReadModeBar
          mode="listen"
          playbackRate={playbackRate}
          onModeChange={onModeChange}
          onOpenSpeedPicker={() => setShowSpeedPicker(true)}
        />
      </View>

      <ChapterTOCModal
        visible={showTOC}
        book={book}
        currentChapterSlug={chapter.slug}
        onSelectChapter={(slug) => void selectChapter(slug)}
        onClose={() => setShowTOC(false)}
      />

      <SpeedPickerModal
        visible={showSpeedPicker}
        currentRate={playbackRate}
        onSelect={handleSpeedSelect}
        onClose={() => setShowSpeedPicker(false)}
      />

      <BookmarksPanel visible={showBookmarks} onClose={() => setShowBookmarks(false)} />
    </ScreenShell>
  );
}

export const AudiobookListenView = memo(AudiobookListenViewInner);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  headerBtnText: {
    fontSize: 18,
    color: theme.colors.trueBlack,
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  coverFrame: {
    width: 220,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.trueBlack,
    textAlign: 'center',
  },
  author: {
    marginTop: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.dimmedText,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  chapterSkipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  chapterSkipBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  chapterSkipBtnDisabled: {
    opacity: 0.35,
  },
  chapterSkipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.dimmedText,
  },
});
