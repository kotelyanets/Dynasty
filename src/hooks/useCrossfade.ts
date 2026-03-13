/**
 * useCrossfade.ts
 * ─────────────────────────────────────────────────────────────
 * Handles gapless playback and crossfade transitions.
 *
 * Flow:
 *  1. At T-10s: preload the next track into crossfadeEl.
 *  2. At T-crossfadeDuration: start playing crossfadeEl and animate
 *     volumes — current fades out, next fades in.
 *  3. When the fade completes: commit the crossfade — swap audio back
 *     to the main audioEl, update store metadata.
 *
 * The hook subscribes to the Zustand store and runs its own
 * requestAnimationFrame loop during a crossfade transition.
 */

import { useEffect, useRef } from 'react';
import { audioEl, usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/types/music';
import {
  crossfadeEl,
  isAudioPipelineReady,
  getMainGain,
  getCrossfadeGain,
  ensureContextResumed,
} from '@/audio/audioContext';

/** Seconds before the track ends to start preloading the next track. */
const PRELOAD_AHEAD = 10;

export function useCrossfade() {
  const preloaded = useRef(false);
  const fading = useRef(false);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Subscribe to currentTime updates from the store.
    // We check on every time tick whether we need to preload or start the fade.
    const unsub = usePlayerStore.subscribe(
      (s) => ({
        currentTime: s.currentTime,
        duration: s.duration,
        crossfadeEnabled: s.crossfadeEnabled,
        crossfadeDuration: s.crossfadeDuration,
        isPlaying: s.isPlaying,
        queueIndex: s.queueIndex,
        queue: s.queue,
        repeat: s.repeat,
        shuffle: s.shuffle,
        currentTrack: s.currentTrack,
      }),
      (state) => {
        const {
          currentTime, duration, crossfadeEnabled, crossfadeDuration,
          isPlaying, queueIndex, queue, repeat, currentTrack,
        } = state;

        if (!crossfadeEnabled || !isPlaying || !currentTrack?.audioUrl || duration <= 0) {
          return;
        }

        const remaining = duration - currentTime;

        // Determine the next track (without shuffle — crossfade is sequential only)
        const nextIndex = queueIndex + 1;
        const hasNext = nextIndex < queue.length || repeat === 'all';
        if (!hasNext) return;

        const nextTrack = nextIndex < queue.length
          ? queue[nextIndex]
          : repeat === 'all' ? queue[0] : null;
        if (!nextTrack?.audioUrl) return;

        // ── PRELOAD at T-10s ──────────────────────────────────
        if (remaining <= PRELOAD_AHEAD && !preloaded.current) {
          preloaded.current = true;
          crossfadeEl.src = nextTrack.audioUrl;
          crossfadeEl.load();
        }

        // ── START FADE at T-crossfadeDuration ─────────────────
        if (remaining <= crossfadeDuration && !fading.current && preloaded.current) {
          fading.current = true;
          usePlayerStore.getState()._setIsCrossfading(true);
          startCrossfade(crossfadeDuration, nextTrack, queue, nextIndex < queue.length ? nextIndex : 0);
        }
      },
    );

    // Reset flags when track changes
    const unsubTrack = usePlayerStore.subscribe(
      (s) => s.currentTrack?.id,
      () => {
        preloaded.current = false;
        fading.current = false;
        if (rafId.current) {
          cancelAnimationFrame(rafId.current);
          rafId.current = null;
        }
      },
    );

    return () => {
      unsub();
      unsubTrack();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  function startCrossfade(
    fadeDuration: number,
    nextTrack: Track,
    queue: Track[],
    nextIndex: number,
  ) {
    ensureContextResumed();

    const useWebAudio = isAudioPipelineReady();
    const mainGain = getMainGain();
    const xfGain = getCrossfadeGain();

    // Start the crossfade element playback
    crossfadeEl.currentTime = 0;
    const playPromise = crossfadeEl.play();
    if (playPromise) playPromise.catch(() => {});

    const startTime = performance.now();
    const fadeMs = fadeDuration * 1000;

    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / fadeMs);

      // Ease-in-out curve for smooth volume transition
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (useWebAudio && mainGain && xfGain) {
        mainGain.gain.value = 1 - eased;
        xfGain.gain.value = eased;
      } else {
        // Fallback: use element.volume (only works before AudioContext init)
        audioEl.volume = (1 - eased) * usePlayerStore.getState().volume;
        crossfadeEl.volume = eased * usePlayerStore.getState().volume;
      }

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        // Crossfade complete — commit
        commitCrossfade(nextTrack, queue, nextIndex, useWebAudio, mainGain, xfGain);
      }
    }

    rafId.current = requestAnimationFrame(animate);
  }

  function commitCrossfade(
    nextTrack: Track,
    queue: Track[],
    nextIndex: number,
    useWebAudio: boolean,
    mainGain: GainNode | null,
    xfGain: GainNode | null,
  ) {
    const store = usePlayerStore.getState();

    // Pause the old track
    audioEl.pause();

    // Swap: load the next track into the main audioEl from browser cache
    audioEl.src = nextTrack.audioUrl;

    const onReady = () => {
      audioEl.currentTime = crossfadeEl.currentTime;

      const p = audioEl.play();
      if (p) p.catch(() => {});

      // Stop crossfade element
      crossfadeEl.pause();
      crossfadeEl.src = '';

      // Reset gain nodes
      if (useWebAudio && mainGain && xfGain) {
        mainGain.gain.value = 1;
        xfGain.gain.value = 0;
      } else {
        audioEl.volume = store.volume;
        crossfadeEl.volume = 0;
      }

      // Update store metadata (skip audio load since audioEl is already playing)
      store.playTrack(nextTrack, queue, nextIndex, { skipAudioLoad: true });

      store._setIsCrossfading(false);
      fading.current = false;
      preloaded.current = false;
    };

    // Wait for audioEl to be ready
    if (audioEl.readyState >= 3) {
      onReady();
    } else {
      audioEl.addEventListener('canplay', onReady, { once: true });
      audioEl.load();
    }
  }
}
