/**
 * LyricsView.tsx — Full-screen Apple Music Sing overlay
 * ─────────────────────────────────────────────────────────────
 * Displays synced lyrics over a blurred album-art ambient background.
 * The active line is large, white, and centered; inactive lines are
 * dimmed and slightly blurred—replicating the Apple Music Sing UX.
 *
 * Toggled from the NowPlaying screen via a Quote (") icon button.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { api } from '@/services/api';
import { parseLrc, type LyricLine } from '@/utils/lrcParser';
import { ChevronDown, Music } from 'lucide-react';
import { haptic } from '@/utils/haptics';

interface LyricsViewProps {
  /** Track ID to fetch lyrics for */
  trackId: string;
  /** Current playback time in seconds */
  currentTime: number;
  /** Album/cover art URL for the ambient background */
  coverUrl: string;
  /** Callback to close the overlay */
  onClose: () => void;
}

export function LyricsView({ trackId, currentTime, coverUrl, onClose }: LyricsViewProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { seek } = usePlayer();

  // ── Fetch lyrics when track changes ──────────────────────
  useEffect(() => {
    let cancelled = false;
    setLyrics([]);
    setActiveIndex(-1);
    setLoading(true);

    api.getLyrics(trackId).then((raw) => {
      if (cancelled) return;
      if (raw) {
        setLyrics(parseLrc(raw));
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [trackId]);

  // ── Determine active line from currentTime ───────────────
  useEffect(() => {
    if (lyrics.length === 0) return;

    let idx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        idx = i;
        break;
      }
    }

    if (idx !== activeIndex) {
      setActiveIndex(idx);
    }
  }, [currentTime, lyrics, activeIndex]);

  // ── Auto-scroll active line to center ────────────────────
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = lineRefs.current.get(activeIndex);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  const setLineRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      lineRefs.current.set(index, el);
    } else {
      lineRefs.current.delete(index);
    }
  }, []);

  const handleLineClick = useCallback((time: number) => {
    seek(time);
  }, [seek]);

  // Fade-gradient mask for top/bottom edges
  const fadeMask = 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)';

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ animation: 'slideUp 0.38s cubic-bezier(0.32, 0.72, 0, 1) both' }}
    >
      {/* ── Blurred album art background ── */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-[60px] saturate-150"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      {/* ── Header (dismiss button) ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-14 pb-4">
        <button
          onClick={() => { haptic(); onClose(); }}
          className="w-10 h-10 flex items-center justify-center text-white/80 active:opacity-40 active:scale-90 transition-transform -ml-2"
          aria-label="Close lyrics"
        >
          <ChevronDown size={30} strokeWidth={2.5} />
        </button>
        <p className="text-[13px] font-semibold text-white/50 uppercase tracking-widest">
          Lyrics
        </p>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* ── Lyrics content ── */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : lyrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8">
            <Music size={48} className="text-white/20 mb-4" />
            <p className="text-white/40 text-lg font-semibold text-center">
              No lyrics available
            </p>
            <p className="text-white/25 text-sm mt-2 text-center">
              Place a .lrc file next to the audio file to enable synced lyrics
            </p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="h-full overflow-y-auto scrollbar-hide px-6 py-4"
            style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
          >
            {/* Top padding so first line can scroll to center */}
            <div className="h-[40vh]" />

            {lyrics.map((line, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              const isEmpty = !line.text.trim();

              if (isEmpty) {
                return <div key={i} className="h-8" />;
              }

              return (
                <div
                  key={i}
                  ref={(el) => setLineRef(i, el)}
                  onClick={() => handleLineClick(line.time)}
                  className={`cursor-pointer py-2 transition-all duration-300 ease-out select-none ${
                    isActive
                      ? 'text-white text-3xl font-bold tracking-tight opacity-100 scale-105 origin-left'
                      : isPast
                        ? 'text-white/25 text-2xl font-bold tracking-tight'
                        : 'text-white/30 text-2xl font-bold tracking-tight blur-[1px]'
                  }`}
                >
                  {line.text}
                </div>
              );
            })}

            {/* Bottom padding so last line can scroll to center */}
            <div className="h-[50vh]" />
          </div>
        )}
      </div>
    </div>
  );
}
