import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { hasSupabaseConfig, canUseDevGuestBypass } from '../config/env';
import { getSupabaseClient } from '../services/supabase/client';
import { createSessionFromAuthUrl } from '../services/auth/authCallback';
import {
  clearDevGuestSession,
  DEV_GUEST_USER,
  enableDevGuestSession,
  getCurrentSession,
  isDevGuestSession,
  requestEmailOtp,
  signOut,
  verifyEmailOtp,
} from '../services/auth/session';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isHydrated: boolean;
  isSignedIn: boolean;
  isDevGuest: boolean;
  canUseDevGuest: boolean;
  isAuthBusy: boolean;
  authMessage: string | null;
  requestOtp: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  continueWithoutSignIn: () => Promise<void>;
  clearAuthMessage: () => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [devGuestUser, setDevGuestUser] = useState<User | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const current = await getCurrentSession();
      const devGuest = await isDevGuestSession();
      if (!mounted) return;
      setSession(current);
      setDevGuestUser(devGuest ? DEV_GUEST_USER : null);
      setIsHydrated(true);
    })();

    const client = getSupabaseClient();
    if (!client) {
      return () => {
        mounted = false;
      };
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setDevGuestUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Reserved for OAuth (Google/Apple) — email OTP does not use deep links.
  useEffect(() => {
    if (!hasSupabaseConfig()) return;

    const handleUrl = async (url: string) => {
      const result = await createSessionFromAuthUrl(url);
      if (!result.ok && result.message !== 'Not an auth callback URL.') {
        setAuthMessage(result.message);
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const requestOtp = useCallback(async (email: string): Promise<boolean> => {
    setIsAuthBusy(true);
    setAuthMessage(null);

    try {
      const result = await requestEmailOtp(email);
      setAuthMessage(result.message);
      return result.ok;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    setIsAuthBusy(true);
    setAuthMessage(null);

    try {
      const result = await verifyEmailOtp(email, code);
      if (!result.ok) {
        setAuthMessage(result.message);
        return;
      }
      await clearDevGuestSession();
      setDevGuestUser(null);
      setAuthMessage(result.message);
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const continueWithoutSignIn = useCallback(async () => {
    const user = await enableDevGuestSession();
    setDevGuestUser(user);
    setAuthMessage(null);
  }, []);

  const clearAuthMessage = useCallback(() => {
    setAuthMessage(null);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut();
    setSession(null);
    setDevGuestUser(null);
    setAuthMessage(null);
  }, []);

  const user = session?.user ?? devGuestUser;
  const isDevGuest = devGuestUser !== null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isHydrated,
      isSignedIn: Boolean(user),
      isDevGuest,
      canUseDevGuest: canUseDevGuestBypass(),
      isAuthBusy,
      authMessage,
      requestOtp,
      verifyOtp,
      continueWithoutSignIn,
      clearAuthMessage,
      signOutUser,
    }),
    [
      session,
      user,
      isHydrated,
      isDevGuest,
      isAuthBusy,
      authMessage,
      requestOtp,
      verifyOtp,
      continueWithoutSignIn,
      clearAuthMessage,
      signOutUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
