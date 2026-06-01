import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { theme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { usePlayback } from '../context/PlaybackContext';
import { hasSupabaseConfig } from '../config/env';
import {
  getMockBookMetadata,
  getMockChapterCount,
} from '../services/content/mockContentService';
import {
  useContentStore,
  type CatalogSource,
  type TextSource,
} from '../store/useContentStore';

function SourceToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; title: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.toggleGroup}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.toggleRow}>
        {options.map((option) => {
          const active = option.id === value;
          return (
            <Pressable
              key={option.id}
              style={[styles.toggleBtn, active && styles.toggleBtnActive]}
              onPress={() => onChange(option.id)}
            >
              <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
                {option.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { user, isDevGuest, signOutUser } = useAuth();
  const { refreshCatalog } = usePlayback();
  const textSource = useContentStore((s) => s.textSource);
  const catalogSource = useContentStore((s) => s.catalogSource);
  const audioEnabled = useContentStore((s) => s.audioEnabled);
  const setTextSource = useContentStore((s) => s.setTextSource);
  const setCatalogSource = useContentStore((s) => s.setCatalogSource);
  const setAudioEnabled = useContentStore((s) => s.setAudioEnabled);

  const mockMeta = getMockBookMetadata();

  const handleCatalogChange = (next: CatalogSource) => {
    setCatalogSource(next);
    void refreshCatalog();
  };

  const handleTextChange = (next: TextSource) => {
    setTextSource(next);
    void refreshCatalog();
  };

  return (
    <ScreenShell style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.heading}>Profile</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email}>{user?.email ?? 'Unknown'}</Text>
          {isDevGuest ? (
            <Text style={styles.badge}>Local dev session (no cloud sync)</Text>
          ) : null}
        </View>

        {__DEV__ ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Content sources</Text>
            <Text style={styles.hint}>
              Mock book: {mockMeta.slug} ({getMockChapterCount()} chapters)
            </Text>

            <SourceToggle
              label="Catalog"
              value={catalogSource}
              onChange={handleCatalogChange}
              options={[
                { id: 'openlibrary', title: 'Open Library' },
                { id: 'local-seed', title: 'Local seed' },
              ]}
            />

            <SourceToggle
              label="Reading text"
              value={textSource}
              onChange={handleTextChange}
              options={[
                ...(hasSupabaseConfig()
                  ? [{ id: 'supabase' as const, title: 'Supabase' }]
                  : []),
                { id: 'mock-json', title: 'Mock JSON' },
                { id: 'legacy-seed', title: 'Legacy seed' },
              ]}
            />

            <SourceToggle
              label="Audio"
              value={audioEnabled ? 'on' : 'off'}
              onChange={(next) => setAudioEnabled(next === 'on')}
              options={[
                { id: 'off', title: 'Off' },
                { id: 'on', title: 'On' },
              ]}
            />
          </View>
        ) : null}

        <Pressable style={styles.signOutButton} onPress={() => void signOutUser()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.lg,
  },
  card: {
    padding: theme.spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.colors.dimmedText,
  },
  email: {
    marginTop: theme.spacing.xs,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.trueBlack,
  },
  badge: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    color: theme.colors.brandOrange,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.dimmedText,
    marginBottom: theme.spacing.md,
  },
  toggleGroup: {
    marginTop: theme.spacing.md,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.trueBlack,
    marginBottom: theme.spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  toggleBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.trueBlack,
    borderColor: theme.colors.trueBlack,
  },
  toggleBtnText: {
    fontSize: 12,
    color: theme.colors.trueBlack,
  },
  toggleBtnTextActive: {
    color: theme.colors.white,
  },
  signOutButton: {
    marginTop: 'auto',
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.trueBlack,
  },
});
