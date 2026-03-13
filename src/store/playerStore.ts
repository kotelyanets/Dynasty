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
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    bufferingState: 'idle',
    volume: 1,
    isMuted: false,
    shuffle: false,
    repeat: 'off',
    showNowPlaying: false,
    errorMessage: null,

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

    // ─────────────────────────────────────────────────────────
    //  Track loading
    // ─────────────────────────────────────────────────────────

    playTrack: (track, queue, index) => {
      const resolvedQueue = queue ?? [track];
      const resolvedIndex = index ?? resolvedQueue.findIndex((t) => t.id === track.id);
      const finalIndex = resolvedIndex < 0 ? 0 : resolvedIndex;

      set({
        currentTrack: track,
        queue: resolvedQueue,
        queueIndex: finalIndex,
        shuffleHistory: [],
        currentTime: 0,
        duration: track.duration,
        bufferingState: track.audioUrl ? 'loading' : 'ready',
        errorMessage: null,
        isPlaying: true,
      });

      if (track.audioUrl) {
        // Real audio — hand off to the HTMLAudioElement
        stopDemoPlayback();
        audioEl.src = track.audioUrl;
        audioEl.load();
        // play() is called by useAudioEngine once canplay fires
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

    // ─────────────────────────────────────────────────────────
    //  Transport
    // ─────────────────────────────────────────────────────────

    play: () => {
      const { currentTrack } = get();
      if (!currentTrack) return;

      if (currentTrack.audioUrl) {
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
      const { queue, queueIndex, repeat, shuffle, shuffleHistory, currentTrack } = get();
      if (queue.length === 0 || !currentTrack) return;

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
      audioEl.volume = clamped;
      set({ volume: clamped, isMuted: clamped === 0 });
    },

    toggleMute: () => {
      const { isMuted, volume } = get();
      if (isMuted) {
        audioEl.muted = false;
        audioEl.volume = volume || 0.8;
        set({ isMuted: false });
      } else {
        audioEl.muted = true;
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

    // ─────────────────────────────────────────────────────────
    //  UI
    // ─────────────────────────────────────────────────────────

    setShowNowPlaying: (show) => set({ showNowPlaying: show }),
  })),
);

