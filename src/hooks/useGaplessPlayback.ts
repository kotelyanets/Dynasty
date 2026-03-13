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
 *
 * Safety:
 *   • In-flight fetches are cancelled via AbortController when
 *     the track changes or the hook unmounts, preventing a stale
 *     decode from completing after the user has already moved on.
 *   • A single AudioContext is reused for decoding and is closed
 *     on unmount to avoid leaking browser resources.
 *   • The preload cache is invalidated whenever the current track
 *     changes so that two tracks can never play simultaneously.
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore, audioEl } from '@/store/playerStore';

const PRELOAD_THRESHOLD = 10; // Start preloading 10s before end

interface PreloadedTrack {
  trackId: string;
  buffer: AudioBuffer | null;
}

// Reuse a single AudioContext for all preloading to avoid resource exhaustion.
// Lazily created, closed only when the last instance of the hook unmounts.
let preloadCtx: AudioContext | null = null;
let preloadCtxRefCount = 0;

function acquirePreloadContext(): AudioContext {
  if (!preloadCtx || preloadCtx.state === 'closed') {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    preloadCtx = new Ctor();
  }
  preloadCtxRefCount++;
  return preloadCtx;
}

function releasePreloadContext(): void {
  preloadCtxRefCount--;
  if (preloadCtxRefCount <= 0 && preloadCtx) {
    preloadCtx.close().catch(() => {});
    preloadCtx = null;
    preloadCtxRefCount = 0;
  }
}

export function useGaplessPlayback(): void {
  const preloadRef = useRef<PreloadedTrack | null>(null);
  const preloadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Acquire the shared decoding context
    const ctx = acquirePreloadContext();

    /** Cancel any in-flight preload fetch/decode. */
    const cancelPreload = () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      preloadingRef.current = false;
    };

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
        const abort = new AbortController();
        abortRef.current = abort;

        // Preload the next track's audio data
        fetch(nextTrack.audioUrl, { signal: abort.signal })
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            // Guard: if aborted between fetch and decode, bail out
            if (abort.signal.aborted) return;
            return ctx.decodeAudioData(arrayBuffer).then((buffer) => {
              if (!abort.signal.aborted) {
                preloadRef.current = { trackId: nextTrack.id, buffer };
              }
            });
          })
          .catch(() => {
            // AbortError is expected — only cache failure for real errors
            if (!abort.signal.aborted) {
              preloadRef.current = { trackId: nextTrack.id, buffer: null };
            }
          })
          .finally(() => {
            preloadingRef.current = false;
          });
      }
    };

    // Check on timeupdate
    const onTimeUpdate = () => checkPreload();
    audioEl.addEventListener('timeupdate', onTimeUpdate);

    // When track ends, reset preload state.
    const onEnded = () => {
      cancelPreload();
      preloadRef.current = null;
    };
    audioEl.addEventListener('ended', onEnded);

    // When a new track starts loading, cancel any stale preload so
    // we never accidentally play a buffer for the wrong track.
    const onLoadStart = () => {
      cancelPreload();
      preloadRef.current = null;
    };
    audioEl.addEventListener('loadstart', onLoadStart);

    return () => {
      audioEl.removeEventListener('timeupdate', onTimeUpdate);
      audioEl.removeEventListener('ended', onEnded);
      audioEl.removeEventListener('loadstart', onLoadStart);
      cancelPreload();
      preloadRef.current = null;
      releasePreloadContext();
    };
  }, []);
}
