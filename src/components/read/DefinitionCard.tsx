/**
 * DefinitionCard — 25%-height bottom sheet showing the definition of the
 * selected word. Slides up when a word is selected, slides down when dismissed.
 *
 * Fix: uses useWindowDimensions() (reactive, runs after layout) instead of the
 * module-level Dimensions.get() which can return 0 before the window is measured,
 * causing the card to sit at Y=0 (visible) on first mount.
 *
 * Features:
 * - Word + phonetic pronunciation + part of speech badge
 * - Definition + example sentence
 * - Translate row: 5 language pills (ES · FR · JP · ZH · AR)
 * - Translation result replaces definition in same card
 * - Error states for both definition not found and translate failure
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import {
  TRANSLATE_LANGUAGES,
  type TranslateLanguageCode,
  type WordDefinition,
} from '../../hooks/useTextSelection';

interface DefinitionCardProps {
  visible: boolean;
  word: string;
  definition: WordDefinition | null;
  isLoading: boolean;
  translatedText: string | null;
  translationError: string | null;
  isTranslating: boolean;
  onTranslate: (params: { targetLanguage: string }) => void;
}

export function DefinitionCard({
  visible,
  word,
  definition,
  isLoading,
  translatedText,
  translationError,
  isTranslating,
  onTranslate,
}: DefinitionCardProps) {
  const { height: windowHeight } = useWindowDimensions();
  // 28% of actual window height — reactive after layout.
  // Guard against windowHeight=0 (pre-layout frame) so the card never snaps visible.
  const cardHeight = Math.round(windowHeight * 0.28);
  const hideTarget = Math.max(cardHeight, 400);

  // Start well off-screen so the card is never visible before user interaction.
  const slideAnim = useRef(new Animated.Value(hideTarget)).current;
  const [selectedLang, setSelectedLang] = useState<TranslateLanguageCode | null>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : hideTarget,
      useNativeDriver: true,
      tension: 180,
      friction: 18,
    }).start();
  }, [visible, hideTarget, slideAnim]);

  // Reset language picker when word changes or card hides.
  useEffect(() => {
    if (!visible) setSelectedLang(null);
  }, [word, visible]);

  const handleLangPress = useCallback(
    (langCode: TranslateLanguageCode, langLabel: string) => {
      setSelectedLang(langCode);
      onTranslate({ targetLanguage: langLabel });
    },
    [onTranslate],
  );

  return (
    <Animated.View
      style={[
        styles.card,
        { height: cardHeight, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {/* Drag handle */}
      <View style={styles.handle} />

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Word header */}
        <View style={styles.wordRow}>
          <Text style={styles.wordText}>{word}</Text>
          {definition?.phonetic ? (
            <Text style={styles.phonetic}>{definition.phonetic}</Text>
          ) : null}
          {definition?.partOfSpeech ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{definition.partOfSpeech}</Text>
            </View>
          ) : null}
        </View>

        {/* Body: loading → translated → definition → not found */}
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.brandOrange}
            style={styles.loader}
          />
        ) : translatedText ? (
          <Text style={styles.bodyText}>{translatedText}</Text>
        ) : translationError ? (
          <Text style={styles.errorText}>{translationError}</Text>
        ) : definition ? (
          <>
            <Text style={styles.bodyText}>{definition.definition}</Text>
            {definition.example ? (
              <Text style={styles.exampleText}>"{definition.example}"</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.dimText}>No definition found for this word.</Text>
        )}

        {/* Translate row */}
        {!isLoading && (
          <View style={styles.translateRow}>
            <Text style={styles.translateLabel}>Translate</Text>
            <View style={styles.langPills}>
              {TRANSLATE_LANGUAGES.map((lang) => {
                const isActive = selectedLang === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.langPill, isActive && styles.langPillActive]}
                    onPress={() => handleLangPress(lang.code, lang.label)}
                    disabled={isTranslating}
                  >
                    {isTranslating && isActive ? (
                      <ActivityIndicator size="small" color={theme.colors.white} />
                    ) : (
                      <Text
                        style={[styles.langText, isActive && styles.langTextActive]}
                      >
                        {lang.label}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 90,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  wordText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.trueBlack,
    letterSpacing: -0.3,
  },
  phonetic: {
    fontSize: 14,
    color: theme.colors.dimmedText,
    fontStyle: 'italic',
  },
  badge: {
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    borderRadius: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    color: theme.colors.brandOrange,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.sm,
  },
  exampleText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.dimmedText,
    fontStyle: 'italic',
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: '#cc3333',
    marginBottom: theme.spacing.sm,
  },
  dimText: {
    fontSize: 14,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.sm,
  },
  loader: {
    marginVertical: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  translateRow: {
    marginTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  translateLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.dimmedText,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  langPills: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  langPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    minWidth: 40,
    alignItems: 'center',
  },
  langPillActive: {
    backgroundColor: theme.colors.trueBlack,
    borderColor: theme.colors.trueBlack,
  },
  langText: {
    fontSize: 13,
    color: theme.colors.trueBlack,
  },
  langTextActive: {
    color: theme.colors.white,
    fontWeight: '600',
  },
});
