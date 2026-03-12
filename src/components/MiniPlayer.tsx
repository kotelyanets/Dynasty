/**
 * MiniPlayer.tsx  (upgraded)
 * ─────────────────────────────────────────────────────────────
 * Persistent bottom mini-player.
 *
 * Changes vs original:
 *  ✓ Dual-layer progress bar: buffered (grey) + played (rose)
 *  ✓ Spinning loader replaces play icon while buffering/loading
 *  ✓ Error state indicator (red pulse dot)
 *  ✓ Accessible aria-labels on all buttons
 */

import { usePlayer } from '@/context/PlayerContext';
import { Play, Pause, SkipForward, Loader2 } from 'lucide-react';

export function MiniPlayer() {
  const { state, togglePlay, next, showNowPlaying } = usePlayer();
  const {
    currentTrack, isPlaying, currentTime, duration,
    buffered, bufferingState,
  } = state;

  if (!currentTrack) return null;

  const playedPct  = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = buffered * 100;
  const isStalled   = bufferingState === 'buffering' || bufferingState === 'loading';
  const hasError    = bufferingState === 'error';

  return (
    <div className="relative">
      {/* Dual-layer progress bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
        {/* Buffered fill */}
        <div
          className="absolute h-full bg-white/25 transition-[width] duration-500"
          style={{ width: `${bufferedPct}%` }}
        />
        {/* Played fill */}
        <div
          className={`absolute h-full transition-all duration-200 ${
            hasError ? 'bg-red-500' : 'bg-rose-500'
          }`}
          style={{ width: `${playedPct}%` }}
        />
      </div>

      <div
        className="flex items-center gap-3 px-4 py-2 cursor-pointer active:scale-[0.98] active:opacity-90 transition-all duration-200 ease-out"
        onClick={() => showNowPlaying(true)}
        role="button"
        aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}. Tap to expand.`}
      >
        {/* Cover art */}
        <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.album}
            className="w-full h-full object-cover"
          />
          {/* Error dot */}
          {hasError && (
            <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate leading-tight">
            {currentTrack.title}
          </p>
          <p className="text-[12px] text-white/55 truncate leading-tight mt-0.5">
            {currentTrack.artist}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center text-white active:scale-90 active:opacity-70 transition-all duration-200"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isStalled ? (
              <Loader2 size={20} className="animate-spin text-white/70" />
            ) : isPlaying ? (
              <Pause size={22} fill="white" />
            ) : (
              <Play size={22} fill="white" />
            )}
          </button>

          <button
            onClick={next}
            className="w-10 h-10 flex items-center justify-center text-white active:scale-90 active:opacity-70 transition-all duration-200"
            aria-label="Next track"
          >
            <SkipForward size={20} fill="white" />
          </button>
        </div>
      </div>
    </div>
  );
}
