/**
 * useSeekTracking.ts — Records seek events for heatmap data
 * ─────────────────────────────────────────────────────────────
 * Listens for seek actions and sends the timecode to the backend.
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

export function useSeekTracking(): void {
  const lastSeekRef = useRef<number>(0);

  useEffect(() => {
    if (!BASE_URL) return;

    const unsub = usePlayerStore.subscribe(
      (state) => ({ currentTime: state.currentTime, trackId: state.currentTrack?.id }),
      (curr, prev) => {
        // Detect a seek: time jumped by more than 3 seconds in a single update
        if (
          curr.trackId &&
          prev.trackId === curr.trackId &&
          Math.abs(curr.currentTime - prev.currentTime) > 3
        ) {
          const now = Date.now();
          // Throttle: max one seek event per second
          if (now - lastSeekRef.current < 1000) return;
          lastSeekRef.current = now;

          fetch(`${BASE_URL}/api/seek-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackId: curr.trackId,
              timestamp: curr.currentTime,
            }),
          }).catch(() => {});
        }
      },
      { equalityFn: (a, b) => a.currentTime === b.currentTime && a.trackId === b.trackId }
    );

    return unsub;
  }, []);
}
