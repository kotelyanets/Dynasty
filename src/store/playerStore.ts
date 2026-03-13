/**
 * playerStore.ts
 * ─────────────────────────────────────────────────────────────
 * Central audio-player state managed by Zustand.
 *
 * Architecture decision: The HTMLAudioElement is created ONCE as a
 * module-level singleton (outside React). This is intentional:
 *
 *   • Survives React re-renders / StrictMode double-invocations.
 *   • Lets the audio keep playing when the user navigates between pages.
 *   • No need to pass refs around — the store is the single source of truth.
 *   • `useAudioEngine` (a one-time-mounted hook in App.tsx) attaches all
 *     the DOM event listeners and wires them back into this store.
 *   • `useMediaSession` (a one-time-mounted hook in App.tsx) subscribes to
 *     store changes and bridges them to the OS lock-screen / MediaSession.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Track,
  RepeatMode,
  PlayerStore,
} from '@/types/music';
import {
  initAudioPipeline,
  ensureContextResumed,
  setMasterVolume,
  setMasterMuted,
} from '@/audio/audioContext';
import { audioProcessor } from '@/audio/AudioProcessor';

// ─────────────────────────────────────────────────────────────
//  Singleton audio element
//  Lives outside React so it is never garbage-collected while
//  the page is open, even across full component tree remounts.
// ─────────────────────────────────────────────────────────────

export const audioEl = new Audio();
audioEl.preload = 'auto';
// Allow iOS to play audio in the background (Safari requires this
// attribute to be set before the first play() call).
audioEl.setAttribute('playsinline', 'true');
audioEl.setAttribute('webkit-playsinline', 'true');

// ─────────────────────────────────────────────────────────────
//  Demo-mode helper
//  When a track has no real audioUrl we simulate progress so
//  the UI still works. Real tracks get an actual src.
// ─────────────────────────────────────────────────────────────

let demoInterval: ReturnType<typeof setInterval> | null = null;

function startDemoPlayback() {
  stopDemoPlayback();
  demoInterval = setInterval(() => {
    const s = usePlayerStore.getState();
    if (!s.isPlaying || !s.currentTrack) return;
    const next = s.currentTime + 0.25;
    if (next >= s.currentTrack.duration) {
      s._setCurrentTime(s.currentTrack.duration);
      s.next();
    } else {
      s._setCurrentTime(next);
    }
  }, 250);
}

function stopDemoPlayback() {
  if (demoInterval !== null) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
}

// ─────────────────────────────────────────────────────────────
//  Shuffle helpers
// ─────────────────────────────────────────────────────────────

function pickShuffledNext(
  queue: Track[],
  currentIndex: number,
  history: number[],
): number {
  // Build pool of unvisited indices, excluding current
  const visited = new Set([...history, currentIndex]);
  const pool = queue
    .map((_, i) => i)
    .filter((i) => !visited.has(i));

  if (pool.length === 0) {
    // Wrapped around — reset history, pick any except current
    const fallback = queue
      .map((_, i) => i)
      .filter((i) => i !== currentIndex);
    return fallback[Math.floor(Math.random() * fallback.length)] ?? 0;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────
//  Store
// ─────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set, get) => ({
    // ── initial state ────────────────────────────────────────
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    shuffleHistory: [],
    playHistory: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    bufferingState: 'idle',
    volume: 1,
    isMuted: false,
    shuffle: false,
    repeat: 'off',
    crossfadeEnabled: false,
    crossfadeDuration: 5,
    autoplayInfinity: false,
    _isCrossfading: false,
    _awaitingAutoplay: false,
    showNowPlaying: false,
    errorMessage: null,
    karaokeEnabled: false,
    spatialAudioEnabled: false,

    // ─────────────────────────────────────────────────────────
    //  Internal setters — called exclusively by useAudioEngine
    // ─────────────────────────────────────────────────────────

    _setCurrentTime: (t) => {
      set({ currentTime: t });
    },

    _setDuration: (d) => set({ duration: d }),

    _setBuffered: (b) => set({ buffered: b }),

    _setBufferingState: (s) => set({ bufferingState: s }),

    _setIsPlaying: (v) => {
      set({ isPlaying: v });
    },

    _setError: (msg) =>
      set({ errorMessage: msg, bufferingState: msg ? 'error' : 'idle' }),

    _setIsCrossfading: (v) => set({ _isCrossfading: v }),

    _setAwaitingAutoplay: (v) => set({ _awaitingAutoplay: v }),

    // ─────────────────────────────────────────────────────────
    //  Track loading
    // ─────────────────────────────────────────────────────────

    playTrack: (track, queue, index, options) => {
      const resolvedQueue = queue ?? [track];
      const resolvedIndex = index ?? resolvedQueue.findIndex((t) => t.id === track.id);
      const finalIndex = resolvedIndex < 0 ? 0 : resolvedIndex;

      // Push the previous track to play history
      const { currentTrack, playHistory } = get();
      const newHistory = currentTrack
        ? [currentTrack, ...playHistory.filter((t) => t.id !== currentTrack.id)].slice(0, 50)
        : playHistory;

      set({
        currentTrack: track,
        queue: resolvedQueue,
        queueIndex: finalIndex,
        shuffleHistory: [],
        playHistory: newHistory,
        currentTime: 0,
        duration: track.duration,
        bufferingState: track.audioUrl ? 'loading' : 'ready',
        errorMessage: null,
        isPlaying: true,
      });

      if (track.audioUrl) {
        // Initialise Web Audio pipeline on the first real play (user gesture).
        initAudioPipeline(audioEl);
        ensureContextResumed();

        if (!options?.skipAudioLoad) {
          // Real audio — hand off to the HTMLAudioElement
          stopDemoPlayback();
          audioEl.src = track.audioUrl;
          audioEl.load();
          // play() is called by useAudioEngine once canplay fires
        }
      } else {
        // Demo mode — no real file, simulate progress
        audioEl.src = '';
        startDemoPlayback();
      }
    },

    playQueueIndex: (index) => {
      const { queue } = get();
      if (index < 0 || index >= queue.length) return;
      get().playTrack(queue[index], queue, index);
    },

    addToQueue: (tracks) =>
      set((s) => ({ queue: [...s.queue, ...tracks] })),

    clearQueue: () =>
      set({ queue: [], queueIndex: -1, currentTrack: null, isPlaying: false }),

    reorderQueue: (fromIndex, toIndex) => {
      const { queue, queueIndex } = get();
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= queue.length) return;
      if (toIndex < 0 || toIndex >= queue.length) return;
      const newQueue = [...queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      // Update queueIndex to keep pointing at the currently playing track
      let newIndex = queueIndex;
      if (queueIndex === fromIndex) {
        newIndex = toIndex;
      } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
        newIndex = queueIndex - 1;
      } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
        newIndex = queueIndex + 1;
      }
      set({ queue: newQueue, queueIndex: newIndex });
    },

    // ─────────────────────────────────────────────────────────
    //  Transport
    // ─────────────────────────────────────────────────────────

    play: () => {
      const { currentTrack } = get();
      if (!currentTrack) return;

      if (currentTrack.audioUrl) {
        ensureContextResumed();
        // Real audio: the promise returned by play() must be handled to
        // avoid the "play() interrupted by a new load request" DOMException
        const p = audioEl.play();
        if (p !== undefined) {
          p.catch((err: Error) => {
            // AbortError is benign (user navigated away mid-play)
            if (err.name !== 'AbortError') {
              console.error('[AudioEngine] play() failed:', err);
              get()._setError(err.message);
            }
          });
        }
      } else {
        set({ isPlaying: true });
        startDemoPlayback();
      }
    },

    pause: () => {
      if (get().currentTrack?.audioUrl) {
        audioEl.pause();
      } else {
        set({ isPlaying: false });
        stopDemoPlayback();
      }
    },

    togglePlay: () => {
      get().isPlaying ? get().pause() : get().play();
    },

    next: () => {
      const { queue, queueIndex, repeat, shuffle, shuffleHistory, currentTrack, _isCrossfading } = get();
      if (queue.length === 0 || !currentTrack) return;

      // During an active crossfade, the transition is handled by useCrossfade.
      // Don't advance the queue a second time.
      if (_isCrossfading) return;

      if (repeat === 'one') {
        // Replay the same track from the start
        get().seek(0);
        get().play();
        return;
      }

      let nextIndex: number;
      let newHistory = [...shuffleHistory];

      if (shuffle) {
        newHistory.push(queueIndex);
        nextIndex = pickShuffledNext(queue, queueIndex, newHistory);
      } else {
        nextIndex = queueIndex + 1;
        if (nextIndex >= queue.length) {
          if (repeat === 'all') {
            nextIndex = 0;
            newHistory = [];
          } else if (get().autoplayInfinity) {
            // Signal that we need more tracks from the autoplay hook
            set({ _awaitingAutoplay: true });
            return;
          } else {
            // End of queue
            get()._setIsPlaying(false);
            stopDemoPlayback();
            return;
          }
        }
      }

      set({ shuffleHistory: newHistory });
      get().playTrack(queue[nextIndex], queue, nextIndex);
    },

    prev: () => {
      const { queue, queueIndex, currentTime, shuffle, shuffleHistory } = get();

      // If more than 3 seconds played — restart current track
      if (currentTime > 3) {
        get().seek(0);
        return;
      }

      if (queue.length === 0) return;

      let prevIndex: number;
      let newHistory = [...shuffleHistory];

      if (shuffle && newHistory.length > 0) {
        // Pop the last visited index from history
        prevIndex = newHistory.pop()!;
      } else {
        prevIndex = queueIndex - 1;
        if (prevIndex < 0) prevIndex = 0;
      }

      set({ shuffleHistory: newHistory });
      get().playTrack(queue[prevIndex], queue, prevIndex);
    },

    seek: (time) => {
      const { currentTrack, duration } = get();
      if (!currentTrack) return;
      const clamped = Math.max(0, Math.min(time, duration));

      if (currentTrack.audioUrl) {
        audioEl.currentTime = clamped;
      } else {
        set({ currentTime: clamped });
      }
    },

    // ─────────────────────────────────────────────────────────
    //  Audio properties
    // ─────────────────────────────────────────────────────────

    setVolume: (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      setMasterVolume(clamped, audioEl);
      set({ volume: clamped, isMuted: clamped === 0 });
    },

    toggleMute: () => {
      const { isMuted, volume } = get();
      if (isMuted) {
        const vol = volume || 0.8;
        setMasterMuted(false, audioEl, vol);
        set({ isMuted: false });
      } else {
        setMasterMuted(true, audioEl, 0);
        set({ isMuted: true });
      }
    },

    // ─────────────────────────────────────────────────────────
    //  Modes
    // ─────────────────────────────────────────────────────────

    toggleShuffle: () =>
      set((s) => ({ shuffle: !s.shuffle, shuffleHistory: [] })),

    toggleRepeat: () => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      set((s) => ({
        repeat: order[(order.indexOf(s.repeat) + 1) % order.length],
      }));
    },

    toggleCrossfade: () =>
      set((s) => ({ crossfadeEnabled: !s.crossfadeEnabled })),

    setCrossfadeDuration: (seconds) =>
      set({ crossfadeDuration: Math.max(1, Math.min(12, seconds)) }),

    toggleAutoplayInfinity: () =>
      set((s) => ({ autoplayInfinity: !s.autoplayInfinity, _awaitingAutoplay: false })),

    // ─────────────────────────────────────────────────────────
    //  Audio effects
    // ─────────────────────────────────────────────────────────

    toggleKaraoke: () => {
      const enabled = audioProcessor.toggleKaraoke();
      set({ karaokeEnabled: enabled });
    },

    toggleSpatialAudio: () => {
      const enabled = audioProcessor.toggleSpatialAudio();
      set({ spatialAudioEnabled: enabled });
    },

    // ─────────────────────────────────────────────────────────
    //  UI
    // ─────────────────────────────────────────────────────────

    setShowNowPlaying: (show) => set({ showNowPlaying: show }),
  })),
);

