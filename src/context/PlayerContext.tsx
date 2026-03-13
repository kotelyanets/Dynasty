/**
 * PlayerContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Backward-compatibility adapter.
 *
 * ALL existing UI components (MiniPlayer, NowPlaying, TrackRow,
 * AlbumDetail, etc.) call `usePlayer()` and receive exactly the
 * same shape they always did — zero changes required in those files.
 *
 * Internally, every call is delegated to the Zustand playerStore
 * which owns the real audio element and all state.
 *
 * The Provider shell is kept so App.tsx doesn't need to change.
 */

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import type { Track, RepeatMode, BufferingState } from '@/types/music';

// ─────────────────────────────────────────────────────────────
//  Public context shape (unchanged from original)
// ─────────────────────────────────────────────────────────────

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;          // ← NEW: 0-1 buffered fraction
  bufferingState: BufferingState; // ← NEW: granular loading state
  volume: number;
  isMuted: boolean;          // ← NEW
  shuffle: boolean;
  repeat: RepeatMode;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  autoplayInfinity: boolean;
  showNowPlaying: boolean;
  errorMessage: string | null; // ← NEW
}

interface PlayerContextType {
  state: PlayerState;
  playTrack: (track: Track, queue?: Track[], index?: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;   // ← NEW
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleCrossfade: () => void;
  setCrossfadeDuration: (seconds: number) => void;
  toggleAutoplayInfinity: () => void;
  showNowPlaying: (show: boolean) => void;
  addToQueue: (tracks: Track[]) => void;
  formatTime: (seconds: number) => string;
}

const PlayerContext = createContext<PlayerContextType>(null as unknown as PlayerContextType);

// ─────────────────────────────────────────────────────────────
//  Provider
// ─────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: ReactNode }) {
  // Pull the entire Zustand store state + actions.
  // Because usePlayerStore subscribes with fine-grained selectors via
  // subscribeWithSelector middleware, components that call usePlayer()
  // re-render only when the pieces of state they read actually change.
  const storeState = usePlayerStore();

  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Wrap setShowNowPlaying to match the original API signature
  const showNowPlayingFn = useCallback(
    (show: boolean) => storeState.setShowNowPlaying(show),
    [storeState.setShowNowPlaying],
  );

  const state: PlayerState = {
    currentTrack: storeState.currentTrack,
    queue: storeState.queue,
    queueIndex: storeState.queueIndex,
    isPlaying: storeState.isPlaying,
    currentTime: storeState.currentTime,
    duration: storeState.duration,
    buffered: storeState.buffered,
    bufferingState: storeState.bufferingState,
    volume: storeState.volume,
    isMuted: storeState.isMuted,
    shuffle: storeState.shuffle,
    repeat: storeState.repeat,
    crossfadeEnabled: storeState.crossfadeEnabled,
    crossfadeDuration: storeState.crossfadeDuration,
    autoplayInfinity: storeState.autoplayInfinity,
    showNowPlaying: storeState.showNowPlaying,
    errorMessage: storeState.errorMessage,
  };

  return (
    <PlayerContext.Provider
      value={{
        state,
        playTrack: storeState.playTrack,
        play: storeState.play,
        pause: storeState.pause,
        togglePlay: storeState.togglePlay,
        next: storeState.next,
        prev: storeState.prev,
        seek: storeState.seek,
        setVolume: storeState.setVolume,
        toggleMute: storeState.toggleMute,
        toggleShuffle: storeState.toggleShuffle,
        toggleRepeat: storeState.toggleRepeat,
        toggleCrossfade: storeState.toggleCrossfade,
        setCrossfadeDuration: storeState.setCrossfadeDuration,
        toggleAutoplayInfinity: storeState.toggleAutoplayInfinity,
        showNowPlaying: showNowPlayingFn,
        addToQueue: storeState.addToQueue,
        formatTime,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
//  Hook (unchanged call signature for all existing consumers)
// ─────────────────────────────────────────────────────────────

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
