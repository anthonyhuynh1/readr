import { useCallback, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';

const MOVE_THRESHOLD_PX = 10;

interface UseLongPressOptions {
  delayMs?: number;
  onLongPress: () => void;
}

/**
 * Touch-based long-press that works alongside nested word tap targets.
 * Cancels when the finger moves (scroll) or on short release.
 */
export function useLongPress({ delayMs = 480, onLongPress }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      triggeredRef.current = false;
      const { pageX, pageY } = event.nativeEvent;
      startRef.current = { x: pageX, y: pageY };

      cancel();
      timerRef.current = setTimeout(() => {
        triggeredRef.current = true;
        onLongPress();
      }, delayMs);
    },
    [cancel, delayMs, onLongPress],
  );

  const onTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      const dx = Math.abs(pageX - startRef.current.x);
      const dy = Math.abs(pageY - startRef.current.y);
      if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
        cancel();
      }
    },
    [cancel],
  );

  const onTouchEnd = useCallback(() => {
    cancel();
  }, [cancel]);

  const consumeIfTriggered = useCallback(() => {
    if (triggeredRef.current) {
      triggeredRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
    consumeIfTriggered,
  };
}
