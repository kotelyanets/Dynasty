import { usePlayer } from '@/context/PlayerContext';
import { Play, Pause, SkipForward, Loader2 } from 'lucide-react';

export function MiniPlayer() {
  const { state, togglePlay, next, showNowPlaying } = usePlayer();
  const { currentTrack, isPlaying, currentTime, duration, buffered, bufferingState } = state;

  if (!currentTrack) return null;

  const playedPct  = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = buffered * 100;
  const isStalled  = bufferingState === 'buffering' || bufferingState === 'loading';
  const hasError   = bufferingState === 'error';

  return (
    <div className="px-3 pb-2 pt-1">
      <div
        className="relative rounded-[18px] overflow-hidden shadow-2xl cursor-pointer active:scale-[0.985] transition-transform duration-150 ease-out"
        onClick={() => showNowPlaying(true)}
        role="button"
        aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}. Tap to expand.`}
        style={{
          background: 'rgba(29, 29, 31, 0.95)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        }}
      >
        {/* Album art color tint bleed in background */}
        <img
          src={currentTrack.coverUrl}
          className="absolute inset-0 w-full h-full object-cover blur-3xl scale-150 opacity-30 saturate-200"
          alt=""
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/25" />

        <div className="relative flex items-center gap-3 px-3 py-3">
          {/* Album art */}
          <div className="w-12 h-12 rounded-[10px] overflow-hidden flex-shrink-0 shadow-xl relative">
            <img src={currentTrack.coverUrl} alt={currentTrack.album} className="w-full h-full object-cover" />
            {hasError && (
              <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white truncate leading-snug">
              {currentTrack.title}
            </p>
            <p className="text-[12px] text-white/55 truncate">{currentTrack.artist}</p>
          </div>

          {/* Controls — stopPropagation so tapping them won't open NowPlaying */}
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={togglePlay}
              className="w-11 h-11 flex items-center justify-center text-white active:scale-90 active:opacity-60 transition-all duration-150"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isStalled ? (
                <Loader2 size={22} className="animate-spin text-white/70" />
              ) : isPlaying ? (
                <Pause size={24} fill="white" strokeWidth={0} />
              ) : (
                <Play size={24} fill="white" strokeWidth={0} />
              )}
            </button>

            <button
              onClick={next}
              className="w-10 h-10 flex items-center justify-center text-white active:scale-90 active:opacity-60 transition-all duration-150"
              aria-label="Next track"
            >
              <SkipForward size={20} fill="white" strokeWidth={0} />
            </button>
          </div>
        </div>

        {/* Playback progress line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.07]">
          <div
            className="absolute top-0 left-0 h-full bg-white/20 transition-[width] duration-500 ease-out"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className={`absolute top-0 left-0 h-full transition-[width] duration-300 ease-linear ${
              hasError ? 'bg-red-500' : 'bg-[#fc3c44]'
            }`}
            style={{ width: `${playedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
