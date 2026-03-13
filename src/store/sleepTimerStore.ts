/**
 * sleepTimerStore.ts
 * ─────────────────────────────────────────────────────────────
 * Sleep timer with gradual volume fade.
 *
 * Modes:
 *   - 'off'         — timer inactive
 *   - 'timer'       — stop after N minutes
 *   - 'endOfTrack'  — stop when current track ends
 *
 * When the timer expires, volume fades from current → 0 over
 * 5 seconds, then playback is paused and volume restored.
 */

import { create } from 'zustand';
import { audioEl, usePlayerStore } from '@/store/playerStore';

export type SleepMode = 'off' | 'timer' | 'endOfTrack';

interface SleepTimerState {
  mode: SleepMode;
  /** Seconds remaining (only for 'timer' mode) */
  remainingSeconds: number;
  /** Original volume before fade (for restore after cancel) */
  _savedVolume: number;
}

interface SleepTimerActions {
  /** Start a countdown timer (minutes). */
  startTimer: (minutes: number) => void;
  /** Stop after current track ends. */
  startEndOfTrack: () => void;
  /** Cancel any active timer. */
  cancel: () => void;
  /** Called every second by the tick interval. */
  _tick: () => void;
  /** Called when the current track ends (from useAudioEngine). */
  _onTrackEnd: () => void;
}

export type SleepTimerStore = SleepTimerState & SleepTimerActions;

let tickInterval: ReturnType<typeof setInterval> | null = null;

function clearTick() {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function startTick() {
  clearTick();
  tickInterval = setInterval(() => {
    useSleepTimerStore.getState()._tick();
  }, 1000);
}

/** Gradually fade volume to 0 over ~5 seconds, then pause. */
function fadeOutAndPause(savedVolume: number) {
  const FADE_DURATION = 5000; // 5 seconds
  const FADE_STEPS = 50;
  const stepMs = FADE_DURATION / FADE_STEPS;
  const currentVol = audioEl.volume;
  const volStep = currentVol / FADE_STEPS;
  let step = 0;

  const fadeInterval = setInterval(() => {
    step++;
    const newVol = Math.max(0, currentVol - volStep * step);
    audioEl.volume = newVol;

    if (step >= FADE_STEPS) {
      clearInterval(fadeInterval);
      // Pause playback
      usePlayerStore.getState().pause();
      // Restore volume for next play
      audioEl.volume = savedVolume;
      usePlayerStore.setState({ volume: savedVolume });
      // Reset the sleep timer
      useSleepTimerStore.setState({ mode: 'off', remainingSeconds: 0 });
    }
  }, stepMs);
}

export const useSleepTimerStore = create<SleepTimerStore>()((set, get) => ({
  mode: 'off',
  remainingSeconds: 0,
  _savedVolume: 1,

  startTimer: (minutes) => {
    clearTick();
    set({
      mode: 'timer',
      remainingSeconds: minutes * 60,
      _savedVolume: audioEl.volume,
    });
    startTick();
  },

  startEndOfTrack: () => {
    clearTick();
    set({
      mode: 'endOfTrack',
      remainingSeconds: 0,
      _savedVolume: audioEl.volume,
    });
  },

  cancel: () => {
    clearTick();
    set({ mode: 'off', remainingSeconds: 0 });
  },

  _tick: () => {
    const { mode, remainingSeconds, _savedVolume } = get();
    if (mode !== 'timer') return;

    const next = remainingSeconds - 1;
    if (next <= 0) {
      clearTick();
      fadeOutAndPause(_savedVolume);
    } else {
      set({ remainingSeconds: next });
    }
  },

  _onTrackEnd: () => {
    const { mode, _savedVolume } = get();
    if (mode !== 'endOfTrack') return;
    fadeOutAndPause(_savedVolume);
  },
}));
