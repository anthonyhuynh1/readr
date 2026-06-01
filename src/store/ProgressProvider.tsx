import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

interface ProgressContextValue {
  /** Visual timeline ms (audio position minus chapter offset). */
  progressMs: SharedValue<number>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const progressMs = useSharedValue(0);
  const value = useMemo(() => ({ progressMs }), [progressMs]);
  return (
    <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
  );
}

export function usePlaybackProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('usePlaybackProgress must be used within ProgressProvider');
  }
  return ctx;
}
