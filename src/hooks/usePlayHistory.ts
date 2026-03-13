/**
 * usePlayHistory.ts — Play History Recording Hook
 * ─────────────────────────────────────────────────────────────
 * Records listening sessions (>30 seconds) to the backend for
 * "Apple Music Replay" style statistics.
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

const MIN_LISTEN_DURATION = 30; // seconds

export function usePlayHistory(): void {
  const trackStartRef = useRef<{ trackId: string; startTime: number } | null>(null);

  useEffect(() => {
    if (!BASE_URL) return; // Demo mode — skip

    const unsub = usePlayerStore.subscribe(
      (state) => ({ trackId: state.currentTrack?.id, isPlaying: state.isPlaying }),
      (curr, prev) => {
        // Track changed or stopped — record the previous session
        if (prev.trackId && prev.trackId !== curr.trackId) {
          flushHistory(prev.trackId);
        }

        // New track started
        if (curr.trackId && curr.isPlaying && curr.trackId !== prev.trackId) {
          trackStartRef.current = {
            trackId: curr.trackId,
            startTime: Date.now(),
          };
        }

        // Track paused
        if (prev.isPlaying && !curr.isPlaying && curr.trackId) {
          flushHistory(curr.trackId);
        }

        // Track resumed
        if (!prev.isPlaying && curr.isPlaying && curr.trackId) {
          trackStartRef.current = {
            trackId: curr.trackId,
            startTime: Date.now(),
          };
        }
      },
      { equalityFn: (a, b) => a.trackId === b.trackId && a.isPlaying === b.isPlaying }
    );

    return unsub;
  }, []);

  function flushHistory(trackId: string) {
    const ref = trackStartRef.current;
    if (!ref || ref.trackId !== trackId) return;

    const duration = (Date.now() - ref.startTime) / 1000;
    trackStartRef.current = null;

    if (duration >= MIN_LISTEN_DURATION) {
      // Fire and forget — don't block the UI
      fetch(`${BASE_URL}/api/play-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, duration: Math.round(duration) }),
      }).catch(() => {});
    }
  }
}
