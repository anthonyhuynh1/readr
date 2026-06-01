import { useEffect, useState } from 'react';
import { usePlaybackProgress } from '../store/ProgressProvider';

/** Coarse playback clock for UI labels (~4 Hz) without full context re-renders. */
export function useCoarseSyncTime(intervalMs = 250): number {
  const { progressMs } = usePlaybackProgress();
  const [timeMs, setTimeMs] = useState(0);

  useEffect(() => {
    setTimeMs(progressMs.value);
    const id = setInterval(() => {
      setTimeMs(progressMs.value);
    }, intervalMs);
    return () => clearInterval(id);
  }, [progressMs, intervalMs]);

  return timeMs;
}
