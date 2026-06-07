import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { theme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { usePlayback } from '../context/PlaybackContext';
import { useBookmarks } from '../context/BookmarkContext';
import { hasSupabaseConfig } from '../config/env';
import { useContentStore } from '../store/useContentStore';

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
  const { refreshCurrentChapter, stopSessionForSignOut } = usePlayback();
  const { bookmarks } = useBookmarks();
  const [signingOut, setSigningOut] = useState(false);
  const audioEnabled = useContentStore((s) => s.audioEnabled);
  const setAudioEnabled = useContentStore((s) => s.setAudioEnabled);

  const handleAudioChange = (next: 'on' | 'off') => {
    setAudioEnabled(next === 'on');
    void refreshCurrentChapter();
  };

  const pendingBookmarks = bookmarks.filter((b) => b.pending_sync).length;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await stopSessionForSignOut();
      await signOutUser();
    } finally {
      setSigningOut(false);
    }
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
          ) : hasSupabaseConfig() ? (
            <Text style={styles.syncOk}>Bookmarks sync to your account</Text>
          ) : null}
          {!isDevGuest && pendingBookmarks > 0 ? (
            <Text style={styles.badge}>
              {pendingBookmarks} bookmark{pendingBookmarks === 1 ? '' : 's'} waiting to sync
            </Text>
          ) : null}
        </View>

        {__DEV__ ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Playback</Text>
            <SourceToggle
              label="Audio"
              value={audioEnabled ? 'on' : 'off'}
              onChange={handleAudioChange}
              options={[
                { id: 'off', title: 'Off' },
                { id: 'on', title: 'On' },
              ]}
            />
            <Text style={styles.hint}>
              Content streams from Supabase. Turn audio off to read silently; karaoke
              timings still load when available.
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          onPress={() => void handleSignOut()}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
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
  syncOk: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    color: theme.colors.dimmedText,
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
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.trueBlack,
  },
});
