import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenShell } from '../components/ScreenShell';
import { AudioController } from '../components/AudioController';
import { BottomSheetAI } from '../components/BottomSheetAI';
import { AudiobookListenView } from '../components/read/AudiobookListenView';
import { BookCoverImage } from '../components/read/BookCoverImage';
import { ChapterTOCModal } from '../components/read/ChapterTOCModal';
import { ChapterTitleButton } from '../components/read/ChapterTitleButton';
import { ReadModeBar, type ReadViewMode } from '../components/read/ReadModeBar';
import { SpeedPickerModal } from '../components/read/SpeedPickerModal';
import { ReaderView } from '../components/ReaderView';
import { BookmarksPanel } from '../components/BookmarksPanel';
import { theme } from '../constants/theme';
import { usePlaybackSession } from '../context/PlaybackContext';
import { useReadSession } from '../hooks/useReadSession';
import { usePlaybackStore } from '../store/usePlaybackStore';
import type { RootStackParamList } from '../navigation/types';

type ReadRoute = RouteProp<RootStackParamList, 'Read'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function ReadLoadingShell({ bookSlug }: { bookSlug: string }) {
  return (
    <ScreenShell style={styles.loadingRoot}>
      <View style={styles.loadingBody}>
        <View style={styles.loadingCoverFrame}>
          <BookCoverImage bookSlug={bookSlug} title="" />
        </View>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.colors.brandOrange} size="large" />
        </View>
      </View>
    </ScreenShell>
  );
}

function ReadTextView({
  onModeChange,
  onBackToLibrary,
}: {
  onModeChange: (mode: ReadViewMode) => void;
  onBackToLibrary: () => void;
}) {
  const { book, chapter, selectChapter, setPlaybackRate: applyPlaybackRate } =
    usePlaybackSession();
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const setPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);
  const isSwitchingChapter = usePlaybackStore((s) => s.isSwitchingChapter);

  const [showTOC, setShowTOC] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);

  const handleShare = async () => {
    await Share.share({
      message: `I'm reading "${book.title}" by ${book.author} on Readr.`,
    });
  };

  const handleSpeedSelect = (rate: typeof playbackRate) => {
    setPlaybackRate(rate);
    void applyPlaybackRate(rate);
  };

  return (
    <ScreenShell style={styles.readRoot}>
      <View style={styles.readHeader}>
        <Pressable style={styles.headerBtn} onPress={onBackToLibrary} hitSlop={12}>
          <Text style={styles.headerBtnText}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <ChapterTitleButton
            title={chapter.title}
            onPress={() => setShowTOC(true)}
            loading={isSwitchingChapter}
          />
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerBtn} onPress={() => setShowBookmarks(true)}>
            <Text style={styles.headerBtnText}>☑</Text>
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => void handleShare()}>
            <Text style={styles.headerBtnText}>↗</Text>
          </Pressable>
        </View>
      </View>

      <ReaderView />

      <View style={styles.readFooter}>
        <ReadModeBar
          mode="read"
          playbackRate={playbackRate}
          onModeChange={onModeChange}
          onOpenSpeedPicker={() => setShowSpeedPicker(true)}
        />
        <AudioController compact />
      </View>

      <BottomSheetAI />

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

export function ReadScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ReadRoute>();
  const { bookSlug, chapterSlug: initialChapterSlug } = route.params;

  const [mode, setMode] = useState<ReadViewMode>('read');
  const isOpeningBook = usePlaybackStore((s) => s.isOpeningBook);
  const loadedBookSlug = usePlaybackStore((s) => s.loadedBookSlug);

  useReadSession(bookSlug, initialChapterSlug);

  const goToLibrary = () => {
    navigation.navigate('MainTabs', { screen: 'Library' });
  };

  const showBlockingLoader = isOpeningBook || loadedBookSlug !== bookSlug;

  if (showBlockingLoader) {
    return <ReadLoadingShell bookSlug={bookSlug} />;
  }

  if (mode === 'listen') {
    return (
      <AudiobookListenView onModeChange={setMode} onBackToLibrary={goToLibrary} />
    );
  }

  return (
    <ReadTextView onModeChange={setMode} onBackToLibrary={goToLibrary} />
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: '#f4f4f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBody: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCoverFrame: {
    width: 200,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.white,
    opacity: 0.85,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 244, 240, 0.55)',
  },
  readRoot: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  readHeader: {
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
  readFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
});
