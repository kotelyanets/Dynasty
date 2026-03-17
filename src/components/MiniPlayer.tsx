import { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { usePlayer } from '@/context/PlayerContext';
import { Play, Pause, SkipForward, Loader2 } from 'lucide-react';
import { haptic } from '@/utils/haptics';

const SWIPE_THRESHOLD = 50;

import { ErrorBoundary } from '@/components/ErrorBoundary';

function MiniPlayerInner() {
  const { state, togglePlay, next, prev, showNowPlaying } = usePlayer();
  const { currentTrack, isPlaying, currentTime, duration, bufferingState } = state;

  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.4, 1, 0.4]);
  const isSwiping = useRef(false);

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx] }) => {
      if (down) {
        x.set(mx);
        isSwiping.current = Math.abs(mx) > 5;
      } else {
        const flicked = Math.abs(vx) > 0.5;
        const pastThreshold = Math.abs(mx) > SWIPE_THRESHOLD;

        if (pastThreshold || flicked) {
          const slideDir = mx < 0 ? -1 : 1;
          // Animate out, then trigger track change and snap back
          animate(x, slideDir * 300, {
            type: 'spring',
            damping: 30,
            stiffness: 400,
            onComplete: () => {
              if (slideDir < 0) next();
              else prev();
              haptic();
              x.set(0);
            },
          });
        } else {
          // Spring back to center
          animate(x, 0, { type: 'spring', damping: 25, stiffness: 300 });
        }
        // Reset swiping flag after a short delay to allow click events through
        setTimeout(() => { isSwiping.current = false; }, 50);
      }
    },
    { axis: 'x', pointer: { touch: true }, filterTaps: true },
  );

  if (!currentTrack) return null;

  const playedPct  = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isStalled  = bufferingState === 'buffering' || bufferingState === 'loading';

  return (
    <div
      className="fixed left-0 right-0 z-50"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
    >
      {/* Gesture capture layer for horizontal swipe (next/prev track) */}
      <div {...bind()} style={{ touchAction: 'pan-y' }}>
        <motion.div
          style={{ x, opacity }}
          whileTap={{ scale: 0.985 }}
          className="relative mx-2 mb-2 overflow-hidden rounded-xl border border-white/10 bg-black/5 dark:bg-white/10 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)] cursor-pointer transition-transform duration-150 ease-out"
          onClick={() => {
            if (isSwiping.current) return;
            haptic();
            showNowPlaying(true);
          }}
          role="button"
          aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}. Tap to expand.`}
        >
          <div className="relative flex items-center gap-3 px-3 py-2.5">
            {/* Album art — shared element via layoutId */}
            <motion.div
              layoutId="player-album-art"
              className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <img src={currentTrack.coverUrl} alt={currentTrack.album} className="w-full h-full object-cover" />
            </motion.div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {currentTrack.title}
              </p>
              <p className="text-xs text-white/60 truncate">{currentTrack.artist}</p>
            </div>

            {/* Controls — stopPropagation so tapping them won't open NowPlaying */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { haptic(); togglePlay(); }}
                className="w-10 h-10 flex items-center justify-center text-white/95 active:scale-90 active:opacity-60 transition-all duration-150"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isStalled ? (
                  <Loader2 size={20} className="animate-spin text-white/70" />
                ) : isPlaying ? (
                  <Pause size={22} fill="white" strokeWidth={0} />
                ) : (
                  <Play size={22} fill="white" strokeWidth={0} />
                )}
              </button>

              <button
                onClick={() => { haptic(); next(); }}
                className="w-10 h-10 flex items-center justify-center text-white/95 active:scale-90 active:opacity-60 transition-all duration-150"
                aria-label="Next track"
              >
                <SkipForward size={18} fill="white" strokeWidth={0} />
              </button>
            </div>
          </div>

          {/* Playback progress line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20">
            <div
              className="absolute top-0 left-0 h-full bg-white transition-[width] duration-300 ease-linear"
              style={{ width: `${playedPct}%` }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function MiniPlayer() {
  return <ErrorBoundary><MiniPlayerInner /></ErrorBoundary>;
}
