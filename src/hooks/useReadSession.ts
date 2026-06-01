import { useEffect, useRef } from 'react';
import { usePlaybackSession } from '../context/PlaybackContext';

/** Opens a book once when entering Read screen; pauses on exit. */
export function useReadSession(bookSlug: string, chapterSlug?: string): void {
  const { openBook, pauseSession } = usePlaybackSession();
  const openRef = useRef(openBook);
  const pauseRef = useRef(pauseSession);

  openRef.current = openBook;
  pauseRef.current = pauseSession;

  useEffect(() => {
    let active = true;
    (async () => {
      await openRef.current(bookSlug, chapterSlug);
      if (!active) {
        await pauseRef.current();
      }
    })();
    return () => {
      active = false;
      void pauseRef.current();
    };
  }, [bookSlug, chapterSlug]);
}
