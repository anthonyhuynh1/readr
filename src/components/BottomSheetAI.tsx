import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useAi } from '../context/AiContext';
import { usePlayback } from '../context/PlaybackContext';

/**
 * AI assistant bottom sheet — opens when the user long-presses a sentence
 * and selects "Ask AI". Hidden during playback to reduce cognitive load.
 */
export function BottomSheetAI() {
  const {
    aiSheetVisible,
    aiContextSentence,
    aiResponse,
    isAskingAi,
    submitAskAi,
    closeAskAi,
  } = useAi();
  // isImmersive comes from PlaybackContext — hides the sheet during active playback.
  const { isImmersive, book, chapter } = usePlayback();
  const [prompt, setPrompt] = React.useState('');

  if (isImmersive && !aiSheetVisible) {
    return null;
  }

  return (
    <Modal
      visible={aiSheetVisible}
      animationType="slide"
      transparent
      onRequestClose={closeAskAi}
    >
      <Pressable style={styles.backdrop} onPress={closeAskAi}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Ask Readr</Text>

          {aiContextSentence && (
            <View style={styles.contextBlock}>
              <Text style={styles.contextLabel}>Selected passage</Text>
              <Text style={styles.contextText}>{aiContextSentence.text}</Text>
            </View>
          )}

          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ask for interpretation, summary, or context..."
            placeholderTextColor={theme.colors.dimmedText}
            style={styles.input}
            multiline
          />

          <Pressable
            style={styles.askButton}
            onPress={() =>
              void submitAskAi({
                userPrompt: prompt.trim(),
                bookSlug: book.slug,
                chapterSlug: chapter.slug,
                sentences: chapter.sentences,
              })
            }
            disabled={isAskingAi || !prompt.trim()}
          >
            <Text style={styles.askButtonText}>
              {isAskingAi ? 'Thinking...' : 'Ask AI'}
            </Text>
          </Pressable>

          {aiResponse ? (
            <Text style={styles.answer}>{aiResponse.answer}</Text>
          ) : (
            <Text style={styles.placeholder}>
              AI responses appear here after you submit your prompt.
            </Text>
          )}

          <Pressable style={styles.closeButton} onPress={closeAskAi}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
    minHeight: 280,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 13,
    letterSpacing: 1.2,
    fontWeight: '500',
    color: theme.colors.trueBlack,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.lg,
  },
  contextBlock: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  contextLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
  },
  contextText: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.trueBlack,
  },
  input: {
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: theme.colors.trueBlack,
    textAlignVertical: 'top',
  },
  askButton: {
    backgroundColor: theme.colors.trueBlack,
    borderRadius: 24,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  askButtonText: {
    color: theme.colors.white,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  answer: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.lg,
  },
  placeholder: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.lg,
  },
  closeButton: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  closeText: {
    fontSize: 14,
    letterSpacing: 0.4,
    color: theme.colors.brandOrange,
  },
});
