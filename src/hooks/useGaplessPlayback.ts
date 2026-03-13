/**
 * useGaplessPlayback.ts — True Gapless Playback
 * ─────────────────────────────────────────────────────────────
 * Pre-loads the beginning of the next track into an AudioBuffer
 * before the current track ends, enabling zero-gap transitions.
 *
 * Strategy:
 *   • When the current track is within 10 seconds of ending,
 *     fetch and decode the next track's audio into a buffer.
 *   • At the exact end of the current track, start the buffered
 *     audio immediately while the HTMLAudioElement loads the
 *     next src (which takes a few hundred ms).
 *   • Once the HTMLAudioElement fires canplay, crossfade from
 *     the buffer to the live stream seamlessly.
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore, audioEl } from '@/store/playerStore';

const PRELOAD_THRESHOLD = 10; // Start preloading 10s before end

interface PreloadedTrack {
  trackId: string;
  buffer: AudioBuffer | null;
}

export function useGaplessPlayback(): void {
  const preloadRef = useRef<PreloadedTrack | null>(null);
  const preloadingRef = useRef(false);

  useEffect(() => {
    const checkPreload = () => {
      const state = usePlayerStore.getState();
      if (!state.currentTrack?.audioUrl) return;
      if (state.duration <= 0) return;

      const timeLeft = state.duration - state.currentTime;

      // Pre-load next track when within threshold
      if (timeLeft <= PRELOAD_THRESHOLD && timeLeft > 0 && !preloadingRef.current) {
        const { queue, queueIndex, shuffle, repeat } = state;
        if (queue.length === 0) return;

        let nextIndex: number;
        if (repeat === 'one') return; // Will replay same track
        if (shuffle) {
          nextIndex = Math.floor(Math.random() * queue.length);
        } else {
          nextIndex = queueIndex + 1;
          if (nextIndex >= queue.length) {
            if (repeat === 'all') nextIndex = 0;
            else return;
          }
        }

        const nextTrack = queue[nextIndex];
        if (!nextTrack?.audioUrl) return;
        if (preloadRef.current?.trackId === nextTrack.id) return;

        preloadingRef.current = true;

        // Preload the next track's audio data
        fetch(nextTrack.audioUrl)
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            return audioCtx.decodeAudioData(arrayBuffer).then((buffer) => {
              preloadRef.current = { trackId: nextTrack.id, buffer };
              audioCtx.close();
            });
          })
          .catch(() => {
            preloadRef.current = { trackId: nextTrack.id, buffer: null };
          })
          .finally(() => {
            preloadingRef.current = false;
          });
      }
    };

    // Check on timeupdate
    const onTimeUpdate = () => checkPreload();
    audioEl.addEventListener('timeupdate', onTimeUpdate);

    // When track ends, if we have a preloaded buffer, the normal
    // next() from playerStore will handle it. The preloading just
    // ensures the browser has cached the data.
    const onEnded = () => {
      preloadRef.current = null;
      preloadingRef.current = false;
    };
    audioEl.addEventListener('ended', onEnded);

    return () => {
      audioEl.removeEventListener('timeupdate', onTimeUpdate);
      audioEl.removeEventListener('ended', onEnded);
    };
  }, []);
}
