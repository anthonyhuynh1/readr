/**
 * SelectionToolbar — Floating action bar that hovers above a selected word/sentence.
 * Appears via a spring animation. Positioned at the container-relative anchorY.
 *
 * Layout (single sentence):  [←]  Bookmark · Ask AI · Copy  [→]
 * Layout (multi-sentence):   [←]  Bookmark · Ask AI · Copy · 3 sentences  [→]
 *
 * ← / → extend the selection to adjacent sentences.
 * Pressing Bookmark, Ask AI, or Copy automatically dismisses the toolbar.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Clipboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import type { TextSelection } from '../../hooks/useTextSelection';

const TOOLBAR_HEIGHT = 44;
/** Gap between toolbar bottom edge and the top of the selected word. */
const TOOLBAR_OFFSET = 10;

interface SelectionToolbarProps {
  selection: TextSelection;
  selectedText: string;
  isMultiSentence: boolean;
  onBookmark: () => void;
  onAskAi: () => void;
  onDismiss: () => void;
}

export function SelectionToolbar({
  selection,
  selectedText,
  isMultiSentence,
  onBookmark,
  onAskAi,
  onDismiss,
}: SelectionToolbarProps) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 220,
        friction: 14,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handleCopy = () => {
    Clipboard.setString(selectedText);
    onDismiss();
  };

  // Sentence range indicator e.g. "2 sentences"
  const sentenceCount =
    selection.endSentenceIndex - selection.startSentenceIndex + 1;
  const rangeLabel = isMultiSentence
    ? `${sentenceCount} sentence${sentenceCount !== 1 ? 's' : ''}`
    : null;

  // Position toolbar above the selected word (container-relative coords).
  const top = Math.max(8, selection.anchorY - TOOLBAR_HEIGHT - TOOLBAR_OFFSET);

  return (
    <Animated.View
      style={[
        styles.toolbar,
        { top, opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <ToolbarBtn label="Bookmark" onPress={onBookmark} />
      <View style={styles.divider} />
      <ToolbarBtn label="Ask AI" onPress={onAskAi} />
      <View style={styles.divider} />
      <ToolbarBtn label="Copy" onPress={handleCopy} />

      {rangeLabel ? (
        <>
          <View style={styles.divider} />
          <View style={styles.rangeLabel}>
            <Text style={styles.rangeLabelText}>{rangeLabel}</Text>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

function ToolbarBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      onPress={onPress}
      hitSlop={6}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.trueBlack,
    borderRadius: 10,
    height: TOOLBAR_HEIGHT,
    paddingHorizontal: theme.spacing.xs,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    zIndex: 100,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 2,
  },
  btn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 6,
  },
  expandBtn: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: 6,
  },
  btnPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  btnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  rangeLabel: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  rangeLabelText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
