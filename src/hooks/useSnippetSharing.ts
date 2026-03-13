/**
 * useSnippetSharing.ts
 * ─────────────────────────────────────────────────────────────
 * Share a specific timestamp of a track via URL.
 *
 * When sharing, appends ?t=<seconds>&track=<trackId> to the URL.
 * On page load, reads these params and seeks to that time.
 *
 * Example:
 *   https://vault.local/?t=80&track=abc123
 *   → Opens the app and starts playing track abc123 at 1:20
 */

import { useEffect, useCallback } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { api } from '@/services/api';

/**
 * Read ?t= and ?track= from the URL on mount and start playback.
 * Call this once at the app root.
 */
export function useSnippetFromUrl() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const timeParam = params.get('t');
    const trackParam = params.get('track');

    if (!timeParam) return;

    const seekTime = parseFloat(timeParam);
    if (isNaN(seekTime) || seekTime < 0) return;

    if (trackParam) {
      // Load a specific track and seek to time
      api.getTrack(trackParam).then((track) => {
        if (track) {
          usePlayerStore.getState().playTrack(track);
          // Wait for track to load, then seek
          let unsubscribe: (() => void) | null = null;
          unsubscribe = usePlayerStore.subscribe(
            (s) => s.bufferingState,
            (state) => {
              if (state === 'ready') {
                usePlayerStore.getState().seek(seekTime);
                unsubscribe?.();
              }
            },
          );
        }
      });
    } else {
      // Just seek current track (if playing)
      const { currentTrack } = usePlayerStore.getState();
      if (currentTrack) {
        usePlayerStore.getState().seek(seekTime);
      }
    }
  }, []);
}

/**
 * Generate a shareable URL for the current playback position.
 */
export function useShareSnippet() {
  const shareSnippet = useCallback(async () => {
    const { currentTrack, currentTime } = usePlayerStore.getState();
    if (!currentTrack) return;

    const roundedTime = Math.floor(currentTime);
    const url = new URL(window.location.href);
    url.search = ''; // clear existing params
    url.searchParams.set('t', String(roundedTime));
    url.searchParams.set('track', currentTrack.id);

    const shareUrl = url.toString();

    // Use Web Share API if available (iOS Safari)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentTrack.title} — ${currentTrack.artist}`,
          text: `Listen to "${currentTrack.title}" at ${formatTime(roundedTime)}`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or API not available — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard API not available
    }
  }, []);

  return { shareSnippet };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
