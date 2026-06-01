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
import { useCoarseSyncTime } from '../../hooks/useCoarseSyncTime';
import {
  usePlaybackStore,
  type PlaybackSpeed,
} from '../../store/usePlaybackStore';
import { formatPlaybackTime } from '../../utils/formatTime';
import { BookCoverImage } from './BookCoverImage';
import { ChapterTOCModal } from './ChapterTOCModal';
import { ChapterTitleButton } from './ChapterTitleButton';
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
    <Pressable style={styles.iconButton} onPress={onPress} hitSlop={12}>
      <Text style={styles.iconButtonText}>{label}</Text>
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
    togglePlay,
    audioDurationMs,
    audioError,
    skipBack15,
    skipForward15,
    goToPrevChapter,
    goToNextChapter,
    selectChapter,
    setPlaybackRate: applyPlaybackRate,
    hasPrevChapter,
    hasNextChapter,
  } = usePlaybackSession();

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const isSwitchingChapter = usePlaybackStore((s) => s.isSwitchingChapter);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const setPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);

  const syncTimeMs = useCoarseSyncTime();
  const [showTOC, setShowTOC] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);

  const durationMs = Math.max(audioDurationMs, chapter.durationMs, 1);
  const progress = Math.min(1, syncTimeMs / durationMs);
  const remainingMs = Math.max(0, durationMs - syncTimeMs);

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
    <ScreenShell style={styles.root}>
      <View style={styles.header}>
        <IconButton label="←" onPress={onBackToLibrary} />
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

        <View style={styles.chapterRow}>
          <ChapterTitleButton
            variant="inline"
            title={chapter.title}
            onPress={() => setShowTOC(true)}
            loading={isSwitchingChapter}
          />
        </View>
      </View>

      <View style={styles.transport}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatPlaybackTime(syncTimeMs)}</Text>
          <Text style={styles.time}>-{formatPlaybackTime(remainingMs)}</Text>
        </View>

        {audioError ? <Text style={styles.audioError}>{audioError}</Text> : null}

        <View style={styles.controls}>
          <Pressable
            style={[styles.controlBtn, !hasPrevChapter && styles.controlBtnDisabled]}
            onPress={() => void goToPrevChapter()}
            disabled={!hasPrevChapter}
          >
            <Text style={styles.controlIcon}>⏮</Text>
          </Pressable>
          <Pressable style={styles.controlBtn} onPress={() => void skipBack15()}>
            <Text style={styles.skipLabel}>15</Text>
            <Text style={styles.controlIconSmall}>↺</Text>
          </Pressable>
          <Pressable style={styles.playBtn} onPress={() => void togglePlay()}>
            <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
          </Pressable>
          <Pressable style={styles.controlBtn} onPress={() => void skipForward15()}>
            <Text style={styles.skipLabel}>15</Text>
            <Text style={styles.controlIconSmall}>↻</Text>
          </Pressable>
          <Pressable
            style={[styles.controlBtn, !hasNextChapter && styles.controlBtnDisabled]}
            onPress={() => void goToNextChapter()}
            disabled={!hasNextChapter}
          >
            <Text style={styles.controlIcon}>⏭</Text>
          </Pressable>
        </View>

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
    backgroundColor: '#f4f4f0',
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  iconButtonText: {
    fontSize: 18,
    color: theme.colors.trueBlack,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: theme.spacing.md,
  },
  coverFrame: {
    width: 240,
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
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
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    maxWidth: '100%',
    width: '100%',
    paddingHorizontal: theme.spacing.sm,
  },
  transport: {
    paddingBottom: theme.spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.brandOrange,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  time: {
    fontSize: 12,
    color: theme.colors.dimmedText,
    fontVariant: ['tabular-nums'],
  },
  audioError: {
    color: '#b00020',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnDisabled: {
    opacity: 0.25,
  },
  controlIcon: {
    fontSize: 22,
    color: theme.colors.trueBlack,
  },
  controlIconSmall: {
    fontSize: 14,
    color: theme.colors.trueBlack,
  },
  skipLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.dimmedText,
    position: 'absolute',
    top: 6,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.trueBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: theme.colors.white,
    fontSize: 22,
  },
});
