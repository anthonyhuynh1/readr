import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { theme } from '../constants/theme';
import { hasSupabaseConfig, getSupabaseClientKeyKind } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { canSubmitEmailOtp, EMAIL_OTP_MAX_LENGTH } from '../utils/emailOtp';

type AuthStep = 'email' | 'code';

export function AuthScreen() {
  const {
    requestOtp,
    verifyOtp,
    isAuthBusy,
    authMessage,
    canUseDevGuest,
    continueWithoutSignIn,
  } = useAuth();

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const trimmedEmail = email.trim();
  const trimmedCode = code.trim();
  const keyKind = getSupabaseClientKeyKind();
  const messageIsError =
    authMessage !== null &&
    !authMessage.startsWith('We sent a sign-in code') &&
    authMessage !== 'Signed in.';

  const handleSendCode = async () => {
    const ok = await requestOtp(trimmedEmail);
    if (ok) {
      setStep('code');
      setCode('');
    }
  };

  const handleVerifyCode = async () => {
    await verifyOtp(trimmedEmail, trimmedCode);
  };

  return (
    <ScreenShell style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.title}>Readr</Text>
        <Text style={styles.subtitle}>Sign in to sync bookmarks and AI history</Text>

        {step === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isAuthBusy}
            />
            <Pressable
              style={[
                styles.button,
                (!trimmedEmail || isAuthBusy) && styles.buttonDisabled,
              ]}
              onPress={() => void handleSendCode()}
              disabled={!trimmedEmail || isAuthBusy}
            >
              <Text style={styles.buttonText}>
                {isAuthBusy ? 'Sending…' : 'Send Code'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.codeHint}>Enter the sign-in code sent to {trimmedEmail}</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="00000000"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={EMAIL_OTP_MAX_LENGTH}
              editable={!isAuthBusy}
            />
            <Pressable
              style={[
                styles.button,
                (!canSubmitEmailOtp(trimmedCode) || isAuthBusy) && styles.buttonDisabled,
              ]}
              onPress={() => void handleVerifyCode()}
              disabled={!canSubmitEmailOtp(trimmedCode) || isAuthBusy}
            >
              <Text style={styles.buttonText}>
                {isAuthBusy ? 'Verifying…' : 'Verify & Sign In'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.textButton}
              onPress={() => {
                setStep('email');
                setCode('');
              }}
              disabled={isAuthBusy}
            >
              <Text style={styles.textButtonLabel}>Use a different email</Text>
            </Pressable>
          </>
        )}

        {__DEV__ && hasSupabaseConfig() && keyKind !== 'publishable' ? (
          <Text style={styles.keyWarning}>
            App API key is {keyKind} — use sb_publishable_… in .env, then run: npx expo start -c
          </Text>
        ) : null}

        {authMessage ? (
          <Text
            style={[
              styles.message,
              messageIsError ? styles.messageError : styles.messageSuccess,
            ]}
          >
            {authMessage}
          </Text>
        ) : null}

        {canUseDevGuest ? (
          <>
            <Text style={styles.hint}>
              {hasSupabaseConfig()
                ? 'Development: skip sign-in to use the app locally. Cloud bookmark sync requires a real account.'
                : 'Supabase is not configured yet. You can still try the reader locally.'}
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void continueWithoutSignIn()}
            >
              <Text style={styles.secondaryButtonText}>Continue without signing in</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.title.fontSize,
    letterSpacing: theme.typography.title.letterSpacing,
    fontWeight: theme.typography.title.fontWeight,
    color: theme.colors.trueBlack,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.dimmedText,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  codeHint: {
    marginTop: theme.spacing.md,
    fontSize: 13,
    color: theme.colors.dimmedText,
  },
  button: {
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 8,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: theme.colors.white,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  textButton: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  textButtonLabel: {
    fontSize: 13,
    color: theme.colors.dimmedText,
  },
  message: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    lineHeight: 20,
  },
  messageSuccess: {
    color: theme.colors.trueBlack,
  },
  messageError: {
    color: '#b00020',
  },
  hint: {
    marginTop: theme.spacing.lg,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.dimmedText,
    textAlign: 'center',
  },
  keyWarning: {
    marginTop: theme.spacing.md,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.brandOrange,
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: theme.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.trueBlack,
    fontSize: 13,
    fontWeight: '500',
  },
});
