/**
 * SyncedLyrics.tsx — Apple Music–style karaoke lyrics display
 * ─────────────────────────────────────────────────────────────
 * Fetches and parses .lrc files, then auto-scrolls & highlights
 * the currently playing line in sync with the player's currentTime.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { api } from '@/services/api';
import { parseLrc, type LyricLine } from '@/utils/lrcParser';
import { Music } from 'lucide-react';

interface SyncedLyricsProps {
  trackId: string;
  currentTime: number;
  className?: string;
}

export function SyncedLyrics({ trackId, currentTime, className = '' }: SyncedLyricsProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { seek } = usePlayer();

  // Fetch lyrics when track changes
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

  // Update active line based on currentTime
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

  // Auto-scroll active line into view
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = lineRefs.current.get(activeIndex);
    if (el && containerRef.current) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
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

  if (loading) return null;
  if (lyrics.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <Music size={32} className="text-white/20 mb-3" />
        <p className="text-white/30 text-sm font-medium">No lyrics available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto scrollbar-hide py-8 px-2 ${className}`}
      style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}
    >
      {lyrics.map((line, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        const isEmpty = !line.text.trim();

        if (isEmpty) {
          return <div key={i} className="h-6" />;
        }

        return (
          <div
            key={i}
            ref={(el) => setLineRef(i, el)}
            onClick={() => handleLineClick(line.time)}
            className={`cursor-pointer py-1.5 transition-all duration-500 ease-out ${
              isActive
                ? 'text-white text-[26px] font-extrabold leading-tight scale-100 opacity-100'
                : isPast
                  ? 'text-white/25 text-[22px] font-bold leading-snug'
                  : 'text-white/30 text-[22px] font-bold leading-snug blur-[1px]'
            }`}
          >
            {line.text}
          </div>
        );
      })}

      {/* Bottom padding so last line can scroll to center */}
      <div className="h-40" />
    </div>
  );
}
