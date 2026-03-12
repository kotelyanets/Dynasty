/**
 * useMediaSession.ts
 * ─────────────────────────────────────────────────────────────
 * Dedicated hook that bridges the Zustand player store with the
 * browser's Media Session API (navigator.mediaSession).
 *
 * This gives the OS lock-screen / Control Center / AirPods /
 * CarPlay / Android notification controls access to:
 *   • Track metadata  (title, artist, album, artwork)
 *   • Playback state  (playing / paused)
 *   • Position state   (duration, current position)
 *   • Transport actions (play, pause, next, prev, seek)
 *
 * Mount this hook ONCE at the application root (alongside
 * useAudioEngine) so the session is always active.
 */

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/types/music';

// ─────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────

function updateMetadata(track: Track) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: [
      // Provide multiple sizes; iOS picks the best fit for
      // lock screen / Control Center / CarPlay.
      { src: track.coverUrl, sizes: '96x96',   type: 'image/jpeg' },
      { src: track.coverUrl, sizes: '128x128', type: 'image/jpeg' },
      { src: track.coverUrl, sizes: '192x192', type: 'image/jpeg' },
      { src: track.coverUrl, sizes: '256x256', type: 'image/jpeg' },
      { src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' },
    ],
  });
}

function updatePositionState(duration: number, currentTime: number) {
  if (!('mediaSession' in navigator)) return;
  if (!isFinite(duration) || duration <= 0) return;

  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(currentTime, duration),
    });
  } catch {
    // Safari < 15.4 may throw if position > duration during a seek
  }
}

function updatePlaybackState(isPlaying: boolean) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

// ─────────────────────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────────────────────

export function useMediaSession() {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    // ── Register action handlers ─────────────────────────────
    // These fire from the lock screen / AirPods / CarPlay and
    // route straight into our Zustand store actions.
    ms.setActionHandler('play', () => usePlayerStore.getState().play());
    ms.setActionHandler('pause', () => usePlayerStore.getState().pause());
    ms.setActionHandler('nexttrack', () => usePlayerStore.getState().next());
    ms.setActionHandler('previoustrack', () => usePlayerStore.getState().prev());

    ms.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        usePlayerStore.getState().seek(details.seekTime);
      }
    });

    ms.setActionHandler('seekforward', (details) => {
      const { currentTime } = usePlayerStore.getState();
      usePlayerStore.getState().seek(currentTime + (details.seekOffset ?? 10));
    });

    ms.setActionHandler('seekbackward', (details) => {
      const { currentTime } = usePlayerStore.getState();
      usePlayerStore.getState().seek(currentTime - (details.seekOffset ?? 10));
    });

    // ── Subscribe to store changes ───────────────────────────

    // When the current track changes → update metadata
    const unsubTrack = usePlayerStore.subscribe(
      (s) => s.currentTrack,
      (track) => {
        if (track) updateMetadata(track);
      },
    );

    // When currentTime or duration changes → update position
    const unsubPosition = usePlayerStore.subscribe(
      (s) => ({ currentTime: s.currentTime, duration: s.duration }),
      ({ currentTime, duration }) => {
        updatePositionState(duration, currentTime);
      },
      { equalityFn: (a, b) => a.currentTime === b.currentTime && a.duration === b.duration },
    );

    // When isPlaying changes → update playback state
    const unsubPlaying = usePlayerStore.subscribe(
      (s) => s.isPlaying,
      (isPlaying) => {
        updatePlaybackState(isPlaying);
      },
    );

    // ── Set initial state if a track is already loaded ───────
    const { currentTrack, isPlaying, currentTime, duration } = usePlayerStore.getState();
    if (currentTrack) {
      updateMetadata(currentTrack);
      updatePositionState(duration, currentTime);
      updatePlaybackState(isPlaying);
    }

    return () => {
      unsubTrack();
      unsubPosition();
      unsubPlaying();

      // Clean up action handlers
      ms.setActionHandler('play', null);
      ms.setActionHandler('pause', null);
      ms.setActionHandler('nexttrack', null);
      ms.setActionHandler('previoustrack', null);
      ms.setActionHandler('seekto', null);
      ms.setActionHandler('seekforward', null);
      ms.setActionHandler('seekbackward', null);
    };
  }, []); // ← empty deps: register once, subscriptions handle updates
}
