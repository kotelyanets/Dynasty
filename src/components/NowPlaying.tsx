/**
 * NowPlaying.tsx — Apple Music–style full-screen player
 */

import { useRef, useState, useEffect } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { SpectrumBars } from '@/components/SpectrumBars';
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1, ChevronDown,
  ListMusic, Ellipsis, Volume1, VolumeX, Volume2,
  Loader2, AlertCircle, Heart, Infinity,
} from 'lucide-react';

interface NowPlayingProps {
  onNavigate: (view: string, id?: string) => void;
}

export function NowPlaying({ onNavigate }: NowPlayingProps) {
  const {
    state, togglePlay, next, prev, seek,
    toggleShuffle, toggleRepeat, toggleAutoplayInfinity,
    showNowPlaying, formatTime, setVolume, toggleMute,
  } = usePlayer();
  const { isLiked, toggleLike } = useLikedTracks();

  const {
    currentTrack, isPlaying, currentTime, duration,
    shuffle, repeat, autoplayInfinity, showNowPlaying: visible,
    buffered, bufferingState, volume, isMuted,
    errorMessage,
  } = state;

  // ── Scrubber drag state ─────────────────────────────────
  const [isSeeking, setIsSeeking]   = useState(false);
  const [seekTime, setSeekTime]     = useState(0);
  const progressRef                 = useRef<HTMLDivElement>(null);
  const isDragging                  = useRef(false);

  // ── Volume drag state ───────────────────────────────────
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // ── UI overlay state ────────────────────────────────────
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showQueue, setShowQueue]       = useState(false);

  useEffect(() => {
    setIsSeeking(false);
    isDragging.current = false;
  }, [currentTrack?.id]);

  if (!currentTrack || !visible) return null;

  const displayTime = isSeeking ? seekTime : currentTime;
  const playedPct   = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedPct = buffered * 100;
  const isStalled   = bufferingState === 'buffering' || bufferingState === 'loading';

  // ── Scrubber helpers ────────────────────────────────────

  const getSeekTimeFromEvent = (e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent) => {
    if (!progressRef.current) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    const clientX = 'touches' in e
      ? (e as TouchEvent).touches[0]?.clientX ?? (e as TouchEvent).changedTouches[0]?.clientX ?? 0
      : (e as MouseEvent).clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };

  const handleScrubStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setIsSeeking(true);
    setSeekTime(getSeekTimeFromEvent(e));
  };
  const handleScrubMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    setSeekTime(getSeekTimeFromEvent(e));
  };
  const handleScrubEnd = () => {
    if (isDragging.current) {
      isDragging.current = false;
      seek(seekTime);
      setIsSeeking(false);
    }
  };

  // ── Volume helpers ──────────────────────────────────────

  const getVolumeFromEvent = (e: React.TouchEvent | React.MouseEvent): number => {
    if (!volumeRef.current) return volume;
    const rect    = volumeRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const handleVolumeStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsVolumeDragging(true);
    setVolume(getVolumeFromEvent(e));
  };
  const handleVolumeMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isVolumeDragging) return;
    setVolume(getVolumeFromEvent(e));
  };
  const handleVolumeEnd = () => setIsVolumeDragging(false);

  const currentVolume = isMuted ? 0 : volume;
  const liked = isLiked(currentTrack.id);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ animation: 'slideUp 0.38s cubic-bezier(0.32, 0.72, 0, 1) both' }}
    >
      {/* ── Ambient background (vivid album art bleed) ── */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={currentTrack.coverUrl}
          className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-90 saturate-[2]"
          alt=""
          aria-hidden="true"
        />
        {/* Dark gradient layered on top for legibility */}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute bottom-0 left-0 right-0 h-72 bg-gradient-to-t from-black/75 to-transparent" />
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="relative flex flex-col h-full px-6 pt-12 max-w-lg mx-auto w-full"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        {/* ── Dismiss handle / Header ── */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => showNowPlaying(false)}
            className="w-10 h-10 flex items-center justify-center text-white/80 active:opacity-40 active:scale-90 transition-transform -ml-2"
            aria-label="Dismiss player"
          >
            <ChevronDown size={30} strokeWidth={2.5} />
          </button>

          <div className="text-center flex flex-col items-center">
            <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">
              Playing From
            </p>
            <button
              onClick={() => {
                showNowPlaying(false);
                if (currentTrack.albumId) onNavigate('album', currentTrack.albumId);
              }}
              className="text-[13px] font-semibold text-white truncate max-w-[180px] active:opacity-60 transition-opacity"
            >
              {currentTrack.album}
            </button>
          </div>

          <button
            onClick={() => setShowMoreMenu((v) => !v)}
            className="w-10 h-10 flex items-center justify-center text-white/80 active:opacity-40 active:scale-90 transition-transform -mr-2"
            aria-label="More options"
          >
            <Ellipsis size={24} />
          </button>
        </div>

        {/* ── Album art ── */}
        <div className="flex-1 flex items-center justify-center mb-7">
          <div className="relative w-full max-w-[320px] aspect-square">
            <div
              className={`w-full h-full rounded-[18px] overflow-hidden transition-transform duration-500 ease-out ${
                isPlaying && !isStalled
                  ? 'scale-100 shadow-[0_24px_80px_rgba(0,0,0,0.7)]'
                  : 'scale-[0.875] shadow-[0_16px_48px_rgba(0,0,0,0.5)]'
              }`}
            >
              <img
                src={currentTrack.coverUrl}
                alt={`${currentTrack.album} cover art`}
                className="w-full h-full object-cover"
              />
            </div>

            {isStalled && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[18px] bg-black/40">
                <Loader2 size={44} className="text-white/80 animate-spin" />
              </div>
            )}

            {/* Spectrum bars overlay */}
            {isPlaying && !isStalled && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <SpectrumBars barCount={5} height={20} gap={3} color="rgba(255,255,255,0.6)" />
              </div>
            )}
          </div>
        </div>

        {/* ── Track info row ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-[24px] font-bold text-white truncate leading-tight">
              {currentTrack.title}
            </h2>
            <button
              onClick={() => {
                showNowPlaying(false);
                if (currentTrack.artistId) onNavigate('artist', currentTrack.artistId);
              }}
              className="text-[17px] font-medium text-[#fc3c44] truncate active:opacity-60 transition-opacity text-left max-w-full"
            >
              {currentTrack.artist}
            </button>
          </div>

          <button
            onClick={() => toggleLike(currentTrack.id)}
            className="pt-1 active:scale-90 transition-transform flex-shrink-0"
            aria-label={liked ? 'Remove from Liked Tracks' : 'Add to Liked Tracks'}
          >
            <Heart
              size={26}
              strokeWidth={1.75}
              fill={liked ? '#fc3c44' : 'none'}
              className={liked ? 'text-[#fc3c44]' : 'text-white/40'}
            />
          </button>
        </div>

        {/* ── Error banner ── */}
        {errorMessage && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/20 border border-red-500/40 rounded-xl">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300 truncate">{errorMessage}</p>
          </div>
        )}

        {/* ── Scrubber ── */}
        <div className="mb-5">
          <div
            ref={progressRef}
            className="relative h-10 flex items-center cursor-pointer touch-none select-none"
            onMouseDown={handleScrubStart}
            onMouseMove={handleScrubMove}
            onMouseUp={handleScrubEnd}
            onMouseLeave={handleScrubEnd}
            onTouchStart={handleScrubStart}
            onTouchMove={handleScrubMove}
            onTouchEnd={handleScrubEnd}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={displayTime}
          >
            {/* Track */}
            <div className="absolute w-full h-[4px] bg-white/20 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-white/30 rounded-full transition-[width] duration-500"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute h-full bg-white rounded-full"
                style={{ width: `${playedPct}%` }}
              />
            </div>
            {/* Thumb */}
            <div
              className={`absolute bg-white rounded-full shadow-md transition-[width,height,margin] duration-150 ${
                isSeeking ? 'w-5 h-5 -mt-[1px]' : 'w-[14px] h-[14px]'
              }`}
              style={{ left: `calc(${playedPct}% - ${isSeeking ? 10 : 7}px)` }}
            />
          </div>

          <div className="flex justify-between -mt-1">
            <span className="text-[11px] text-white/50 font-medium tabular-nums">
              {formatTime(displayTime)}
            </span>
            <span className="text-[11px] text-white/50 font-medium tabular-nums">
              -{formatTime(Math.max(0, duration - displayTime))}
            </span>
          </div>
        </div>

        {/* ── Transport controls ── */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-all active:scale-90 ${
              shuffle ? 'text-[#fc3c44]' : 'text-white/40'
            }`}
            aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
          >
            <Shuffle size={22} />
          </button>

          <button
            onClick={prev}
            className="p-2 text-white active:scale-90 transition-transform"
            aria-label="Previous"
          >
            <SkipBack size={38} fill="white" strokeWidth={0} />
          </button>

          <button
            onClick={togglePlay}
            className={`w-[72px] h-[72px] bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform ${
              isStalled ? 'opacity-60' : 'opacity-100'
            }`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isStalled ? (
              <Loader2 size={30} className="text-black animate-spin" />
            ) : isPlaying ? (
              <Pause size={32} fill="black" strokeWidth={0} />
            ) : (
              <Play size={32} fill="black" strokeWidth={0} className="ml-1" />
            )}
          </button>

          <button
            onClick={next}
            className="p-2 text-white active:scale-90 transition-transform"
            aria-label="Next"
          >
            <SkipForward size={38} fill="white" strokeWidth={0} />
          </button>

          <button
            onClick={toggleRepeat}
            className={`p-2 transition-all active:scale-90 ${
              repeat !== 'off' ? 'text-[#fc3c44]' : 'text-white/40'
            }`}
            aria-label={`Repeat: ${repeat}`}
          >
            {repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
          </button>
        </div>

        {/* ── Volume ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={toggleMute}
            className="text-white/40 active:opacity-50 flex-shrink-0"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={16} />
            ) : (
              <Volume1 size={16} />
            )}
          </button>

          <div
            ref={volumeRef}
            className="flex-1 relative h-8 flex items-center cursor-pointer touch-none select-none"
            onMouseDown={handleVolumeStart}
            onMouseMove={handleVolumeMove}
            onMouseUp={handleVolumeEnd}
            onMouseLeave={handleVolumeEnd}
            onTouchStart={handleVolumeStart}
            onTouchMove={handleVolumeMove}
            onTouchEnd={handleVolumeEnd}
            role="slider"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(currentVolume * 100)}
          >
            <div className="absolute w-full h-[4px] bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full"
                style={{ width: `${currentVolume * 100}%` }}
              />
            </div>
            <div
              className="absolute w-3 h-3 bg-white rounded-full shadow"
              style={{ left: `calc(${currentVolume * 100}% - 6px)` }}
            />
          </div>

          <button
            onClick={() => setVolume(1)}
            className="text-white/40 active:opacity-50 flex-shrink-0"
            aria-label="Max volume"
          >
            <Volume2 size={16} />
          </button>
        </div>

        {/* ── Bottom action row ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowQueue(true)}
            className="flex-shrink-0 p-2 text-white/40 active:opacity-40 active:scale-90 transition-transform"
            aria-label="View queue"
          >
            <ListMusic size={22} />
          </button>

          <button
            onClick={toggleAutoplayInfinity}
            className={`p-2 transition-all active:scale-90 ${
              autoplayInfinity ? 'text-[#fc3c44]' : 'text-white/40'
            }`}
            aria-label={autoplayInfinity ? 'Autoplay on' : 'Autoplay off'}
          >
            <Infinity size={24} />
          </button>
        </div>

        {/* ── More options popover ── */}
        {showMoreMenu && (
          <div className="absolute right-6 top-16 z-50 w-48 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'rgba(30,30,32,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
          >
            <button
              onClick={() => {
                setShowMoreMenu(false);
                showNowPlaying(false);
                if (currentTrack.albumId) onNavigate('album', currentTrack.albumId);
              }}
              className="w-full px-4 py-3 text-left text-sm text-white/90 active:bg-white/10 border-b border-white/[0.08]"
            >
              Go to Album
            </button>
            <button
              onClick={() => {
                setShowMoreMenu(false);
                showNowPlaying(false);
                if (currentTrack.artistId) onNavigate('artist', currentTrack.artistId);
              }}
              className="w-full px-4 py-3 text-left text-sm text-white/90 active:bg-white/10"
            >
              Go to Artist
            </button>
          </div>
        )}

        {/* ── Queue panel ── */}
        {showQueue && (
          <div
            className="absolute left-0 right-0 bottom-0 z-40 max-h-[55vh] rounded-t-[28px] overflow-hidden"
            style={{ background: 'rgba(22,22,24,0.97)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
          >
            {/* Pill handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/25" />
            </div>
            <div className="flex items-center justify-between px-5 pt-1 pb-3">
              <p className="text-base font-bold text-white">Up Next</p>
              <button
                onClick={() => setShowQueue(false)}
                className="text-sm text-[#fc3c44] font-medium active:opacity-60"
              >
                Done
              </button>
            </div>

            <div className="px-3 pb-8 overflow-y-auto max-h-[42vh] scrollbar-hide">
              {state.queue.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  className={`flex items-center gap-3 px-2 py-2.5 rounded-xl ${
                    index === state.queueIndex ? 'bg-white/[0.09]' : ''
                  }`}
                >
                  <img
                    src={track.coverUrl}
                    alt={track.album}
                    className="w-10 h-10 rounded-[8px] object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      index === state.queueIndex ? 'text-[#fc3c44]' : 'text-white'
                    }`}>{track.title}</p>
                    <p className="text-[12px] text-white/50 truncate">{track.artist}</p>
                  </div>
                </div>
              ))}
              {state.queue.length === 0 && (
                <p className="px-2 py-4 text-sm text-white/40 text-center">
                  Queue is empty
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
