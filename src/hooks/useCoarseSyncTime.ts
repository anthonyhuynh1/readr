import { useEffect, useState } from 'react';
import { usePlaybackProgress } from '../store/ProgressProvider';

/** Throttled playback clock for transport labels (~4 Hz). */
export function useCoarseSyncTime(intervalMs = 250): number {
  const { progressMs } = usePlaybackProgress();
  const [timeMs, setTimeMs] = useState(0);

  useEffect(() => {
    const tick = () => setTimeMs(progressMs.value);
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [progressMs, intervalMs]);

  return timeMs;
}
