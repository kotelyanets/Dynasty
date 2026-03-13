/**
 * NowPlaying.tsx — Apple Music–style full-screen player
 *
 * Features:
 *   • Animated mesh-gradient background (colors extracted from album art)
 *   • Audio quality badges (Lossless / Hi-Res)
 *   • Synced lyrics (karaoke mode) toggle
 *   • Pull-to-dismiss gesture (swipe down to close)
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useToast } from '@/context/ToastContext';
import { audioProcessor } from '@/audio/AudioProcessor';
import { LyricsMesh } from '@/components/LyricsMesh';
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1, ChevronDown,
  ListMusic, Ellipsis, Volume1, VolumeX, Volume2,
  Loader2, AlertCircle, Heart, Download, CheckCircle2,
  Mic, MicOff, Headphones,
} from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { haptic } from '@/utils/haptics';
import type { Track } from '@/types/music';

interface NowPlayingProps {
  onNavigate: (view: string, id?: string) => void;
}

// ─────────────────────────────────────────────────────────────
//  Audio quality badge helpers
// ─────────────────────────────────────────────────────────────

const LOSSLESS_CODECS = new Set(['FLAC', 'ALAC', 'WAV', 'AIFF', 'PCM']);

function isLossless(codec?: string): boolean {
  if (!codec) return false;
  return LOSSLESS_CODECS.has(codec.toUpperCase()) ||
    codec.toUpperCase().includes('FLAC') ||
    codec.toUpperCase().includes('ALAC');
}

function isHiRes(sampleRate?: number, codec?: string): boolean {
  if (!sampleRate || !isLossless(codec)) return false;
  // Hi-Res is generally > 44.1 kHz / 48 kHz (i.e. ≥ 88.2 kHz or > 48 kHz)
  return sampleRate > 48000;
}

function getQualityBadges(track: { codec?: string; sampleRate?: number; bitrate?: number }) {
  const badges: Array<{ label: string; detail?: string }> = [];

  if (isHiRes(track.sampleRate, track.codec)) {
    badges.push({
      label: 'Hi-Res',
      detail: track.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : undefined,
    });
  } else if (isLossless(track.codec)) {
    badges.push({
      label: 'Lossless',
      detail: track.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : undefined,
    });
  }

  return badges;
}

// ─────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────

export function NowPlaying({ onNavigate }: NowPlayingProps) {
  const {
    state, togglePlay, next, prev, seek,
    toggleShuffle, toggleRepeat, showNowPlaying,
    formatTime, setVolume, toggleMute, reorderQueue,
  } = usePlayer();
  const { isLiked, toggleLike } = useLikedTracks();
  const { isDownloaded, isDownloading, downloadTrack, removeDownload } = useOfflineCache();
  const { showToast } = useToast();

  const {
    currentTrack, isPlaying, currentTime, duration,
    shuffle, repeat, autoplayInfinity, showNowPlaying: visible,
    buffered, bufferingState, volume, isMuted,
    errorMessage, playHistory, karaokeEnabled, spatialAudioEnabled,
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
  const [showLyrics, setShowLyrics]     = useState(false);

  // ── Mesh gradient state ─────────────────────────────────
  const [gradientColors, setGradientColors] = useState<string[]>([
    'rgb(30, 30, 40)', 'rgb(60, 30, 80)', 'rgb(20, 50, 80)', 'rgb(50, 20, 60)',
  ]);

  // ── Pull-to-dismiss state ───────────────────────────────
  const [dragY, setDragY]       = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const touchStartY             = useRef(0);
  const touchStartX             = useRef(0);
  const isPullDragging          = useRef(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  // ── Rubber-band scrubber state ─────────────────────────
  const [scrubStretchY, setScrubStretchY] = useState(0);
  const scrubStartY = useRef(0);

  // ── Lyrics mesh toggle ─────────────────────────────────
  const [showLyricsMesh, setShowLyricsMesh] = useState(false);

  useEffect(() => {
    setIsSeeking(false);
    isDragging.current = false;
  }, [currentTrack?.id]);

  // ── dnd-kit sensors for queue drag & drop ───────────────
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor   = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const sensors       = useSensors(pointerSensor, touchSensor);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    haptic();
    const oldIndex = parseInt(String(active.id).split('-')[1], 10);
    const newIndex = parseInt(String(over.id).split('-')[1], 10);
    if (!isNaN(oldIndex) && !isNaN(newIndex) && oldIndex >= 0 && newIndex >= 0) {
      reorderQueue(oldIndex, newIndex);
    }
  }, [reorderQueue]);

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
    // Track vertical position for rubber-band effect
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    scrubStartY.current = clientY;
    setScrubStretchY(0);
  };
  const handleScrubMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    setSeekTime(getSeekTimeFromEvent(e));
    // Calculate vertical stretch for rubber-band effect
    const clientY = 'touches' in e
      ? (e as React.TouchEvent).touches[0]?.clientY ?? 0
      : (e as React.MouseEvent).clientY;
    const deltaY = clientY - scrubStartY.current;
    // Apply diminishing returns (rubber-band feel)
    const stretch = Math.sign(deltaY) * Math.min(Math.abs(deltaY) * 0.4, 40);
    setScrubStretchY(stretch);
  };
  const handleScrubEnd = () => {
    if (isDragging.current) {
      isDragging.current = false;
      seek(seekTime);
      setIsSeeking(false);
      setScrubStretchY(0);
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
  const qualityBadges = getQualityBadges(currentTrack);

  // Pull-to-dismiss transform
  const dismissTransform = isDismissing
    ? 'translateY(100%)'
    : dragY > 0
      ? `translateY(${dragY}px)`
      : undefined;

  const dismissTransition = isDismissing
    ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
    : dragY > 0
      ? 'none'
      : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';

  const dismissOpacity = dragY > 0
    ? Math.max(0.3, 1 - dragY / 400)
    : 1;

  // ── Sleep timer display ─────────────────────────────────
  const formatSleepTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Ensure AudioProcessor is initialized on first interaction ──
  const ensureAudioInit = useCallback(() => {
    if (!audioProcessor.isInitialized) {
      audioProcessor.init();
    }
    audioProcessor.resume();
  }, []);

  const handleToggleKaraoke = useCallback(() => {
    ensureAudioInit();
    toggleKaraoke();
    showToast({
      icon: 'music',
      title: !karaokeEnabled ? 'Karaoke Mode On' : 'Karaoke Mode Off',
    });
  }, [ensureAudioInit, toggleKaraoke, karaokeEnabled, showToast]);

  const handleToggleSpatial = useCallback(() => {
    ensureAudioInit();
    toggleSpatialAudio();
    showToast({
      icon: 'music',
      title: !spatialAudioEnabled ? 'Spatial Audio On' : 'Spatial Audio Off',
    });
  }, [ensureAudioInit, toggleSpatialAudio, spatialAudioEnabled, showToast]);

  const handleToggleLike = useCallback(() => {
    const wasLiked = liked;
    toggleLike(currentTrack.id);
    showToast({
      icon: 'heart',
      title: wasLiked ? 'Removed from Liked' : 'Added to Liked Tracks',
    });
  }, [liked, toggleLike, currentTrack.id, showToast]);

  // Rubber-band scrubber transform
  const scrubberScaleY = scrubStretchY !== 0
    ? Math.max(0.3, 1 - Math.abs(scrubStretchY) / 100)
    : 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        animation: dragY === 0 && !isDismissing ? 'slideUp 0.38s cubic-bezier(0.32, 0.72, 0, 1) both' : undefined,
        transform: dismissTransform,
        transition: dismissTransition,
        opacity: dismissOpacity,
      }}
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      {/* ── Animated mesh gradient background ── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated color blobs */}
        <div className="absolute inset-0" style={{ background: '#000' }}>
          <div
            className="absolute w-[140%] h-[140%] -left-[20%] -top-[20%] opacity-80"
            style={{
              background: `
                radial-gradient(ellipse at 20% 20%, ${gradientColors[0]} 0%, transparent 50%),
                radial-gradient(ellipse at 80% 20%, ${gradientColors[1]} 0%, transparent 50%),
                radial-gradient(ellipse at 60% 80%, ${gradientColors[2]} 0%, transparent 50%),
                radial-gradient(ellipse at 20% 70%, ${gradientColors[3]} 0%, transparent 50%)
              `,
              animation: 'meshFloat 12s ease-in-out infinite alternate',
              filter: 'blur(40px) saturate(1.5)',
            }}
          />
          <div
            className="absolute w-[130%] h-[130%] -left-[15%] -top-[15%] opacity-60"
            style={{
              background: `
                radial-gradient(ellipse at 70% 30%, ${gradientColors[2]} 0%, transparent 45%),
                radial-gradient(ellipse at 30% 70%, ${gradientColors[0]} 0%, transparent 45%),
                radial-gradient(ellipse at 50% 50%, ${gradientColors[3]} 0%, transparent 40%)
              `,
              animation: 'meshFloat 16s ease-in-out infinite alternate-reverse',
              filter: 'blur(50px) saturate(1.3)',
            }}
          />
        </div>
        {/* Dark overlay for legibility */}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute bottom-0 left-0 right-0 h-72 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      {/* ── Pull indicator (visible during drag) ── */}
      {dragY > 10 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
          <div className="w-10 h-1 rounded-full bg-white/40" />
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div
        className="relative flex flex-col h-full px-6 pt-12 max-w-lg mx-auto w-full"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        {/* ── Dismiss handle / Header ── */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => { haptic(); showNowPlaying(false); }}
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

        {/* ── Album art — shared element via layoutId ── */}
        <div className="flex-1 flex items-center justify-center mb-7">
          <div className="relative w-full max-w-[320px] aspect-square">
            <motion.div
              layoutId="player-album-art"
              className={`w-full h-full rounded-[18px] overflow-hidden transition-transform duration-500 ease-out ${
                isPlaying && !isStalled
                  ? 'scale-100 shadow-[0_24px_80px_rgba(0,0,0,0.7)]'
                  : 'scale-[0.875] shadow-[0_16px_48px_rgba(0,0,0,0.5)]'
              }`}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <img
                src={currentTrack.coverUrl}
                alt={`${currentTrack.album} cover art`}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* ── Track info row ── */}
            <div className="flex items-start justify-between gap-3 mb-2">
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

          <button
            onClick={() => { haptic(); toggleLike(currentTrack.id); }}
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

        {/* ── Scrubber (rubber-band) ── */}
        <div className="mb-5" style={{
          transform: `translateY(${scrubStretchY}px) scaleY(${scrubberScaleY})`,
          transition: isSeeking ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}>
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
            onClick={prev}
            className="p-2 text-white active:scale-90 active:opacity-60 transition-all"
            aria-label="Previous"
          >
            <SkipBack size={36} fill="white" strokeWidth={0} />
          </button>

          <button
            onClick={togglePlay}
            className={`w-[68px] h-[68px] flex items-center justify-center active:scale-90 active:opacity-70 transition-all ${
              isStalled ? 'opacity-60' : 'opacity-100'
            }`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isStalled ? (
              <Loader2 size={44} className="text-white animate-spin" />
            ) : isPlaying ? (
              <Pause size={46} fill="white" strokeWidth={0} />
            ) : (
              <Play size={46} fill="white" strokeWidth={0} className="ml-1" />
            )}
          </button>

          <button
            onClick={next}
            className="p-2 text-white active:scale-90 active:opacity-60 transition-all"
            aria-label="Next"
          >
            <SkipForward size={36} fill="white" strokeWidth={0} />
          </button>
        </div>

        {/* ── Shuffle / Repeat / Effects row ── */}
        <div className="flex items-center justify-between px-2 mb-6">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-all active:scale-90 ${
              shuffle ? 'text-[#fc3c44]' : 'text-white/40'
            }`}
            aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
          >
            <Shuffle size={20} />
          </button>

          <button
            onClick={() => { haptic(); toggleRepeat(); }}
            className={`p-2 transition-all active:scale-90 ${
              repeat !== 'off' ? 'text-[#fc3c44]' : 'text-white/40'
            }`}
            aria-label={`Repeat: ${repeat}`}
          >
            {repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
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
            onClick={() => setShowLyrics((v) => !v)}
            className={`flex-shrink-0 p-2 active:opacity-40 active:scale-90 transition-all ${
              showLyrics ? 'text-[#fc3c44]' : 'text-white/40'
            }`}
            aria-label={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
          >
            <Mic2 size={22} />
          </button>

          <button
            onClick={() => setShowQueue(true)}
            className="flex-shrink-0 p-2 text-white/40 active:opacity-40 active:scale-90 transition-transform"
            aria-label="View queue"
          >
            <ListMusic size={22} />
          </button>
        </div>

        {/* ── More options bottom sheet ── */}
        <BottomSheet open={showMoreMenu} onClose={() => setShowMoreMenu(false)} title="Options">
          <div className="px-2 pb-4">
            <button
              onClick={() => {
                setShowMoreMenu(false);
                showNowPlaying(false);
                if (currentTrack.albumId) onNavigate('album', currentTrack.albumId);
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-[15px] text-white/90 active:bg-white/10 rounded-xl"
            >
              Go to Album
            </button>
            <div className="mx-4 border-b border-white/[0.08]" />
            <button
              onClick={() => {
                setShowMoreMenu(false);
                showNowPlaying(false);
                if (currentTrack.artistId) onNavigate('artist', currentTrack.artistId);
              }}
              className="w-full px-4 py-3 text-left text-sm text-white/90 active:bg-white/10 border-b border-white/[0.08]"
            >
              Go to Artist
            </button>
            {/* Download for offline */}
            {currentTrack.audioUrl && (
              <button
                onClick={async () => {
                  if (isDownloaded(currentTrack.id)) {
                    await removeDownload(currentTrack);
                    showToast({ icon: 'remove', title: 'Download Removed' });
                  } else {
                    await downloadTrack(currentTrack);
                    showToast({ icon: 'download', title: 'Downloaded' });
                  }
                  setShowMoreMenu(false);
                }}
                disabled={isDownloading(currentTrack.id)}
                className="w-full px-4 py-3 text-left text-sm text-white/90 active:bg-white/10 flex items-center gap-2"
              >
                {isDownloading(currentTrack.id) ? (
                  <>
                    <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    Downloading…
                  </>
                ) : isDownloaded(currentTrack.id) ? (
                  <>
                    <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                    Remove Download
                  </>
                ) : (
                  <>
                    <Download size={14} className="flex-shrink-0" />
                    Download
                  </>
                )}
              </button>
            )}
          </div>
        </BottomSheet>

        {/* ── Queue bottom sheet with drag & drop ── */}
        <BottomSheet open={showQueue} onClose={() => setShowQueue(false)} title="Up Next">
          <div className="px-3 pb-4">
            {state.queue.length === 0 ? (
              <p className="px-2 py-4 text-sm text-white/40 text-center">
                Queue is empty
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={state.queue.map((_: Track, i: number) => `queue-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {state.queue.map((track: Track, index: number) => (
                    <SortableQueueItem
                      key={`${track.id}-${index}`}
                      id={`queue-${index}`}
                      track={track}
                      isActive={index === state.queueIndex}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sortable queue item — used by dnd-kit inside the queue panel
// ─────────────────────────────────────────────────────────────

function SortableQueueItem({ id, track, isActive }: { id: string; track: Track; isActive: boolean }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-2 py-2.5 rounded-xl ${
        isActive ? 'bg-white/[0.09]' : ''
      }`}
    >
      <img
        src={track.coverUrl}
        alt={track.album}
        className="w-10 h-10 rounded-[8px] object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${
          isActive ? 'text-[#fc3c44]' : 'text-white'
        }`}>{track.title}</p>
        <p className="text-[12px] text-white/50 truncate">{track.artist}</p>
      </div>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-white/30 active:text-white/60 touch-none flex-shrink-0"
        aria-label="Reorder track"
      >
        <GripVertical size={18} />
      </button>
    </div>
  );
}
