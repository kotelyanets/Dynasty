/**
 * Storylines.tsx — Timeline facts overlay for NowPlaying
 * ─────────────────────────────────────────────────────────────
 * Like Spotify's "Behind the Lyrics" or Apple Music's storylines.
 *
 * Displays animated fact cards at specific timestamps during
 * track playback. Facts are defined in a JSON structure with
 * timecodes.
 *
 * The component subscribes to currentTime from the player store
 * and shows/hides cards based on the current playback position.
 */

import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';

export interface StorylineFact {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Fact text to display */
  text: string;
  /** Optional source/attribution */
  source?: string;
}

export interface TrackStoryline {
  trackId: string;
  facts: StorylineFact[];
}

interface StorylinesProps {
  storyline?: TrackStoryline | null;
}

export function Storylines({ storyline }: StorylinesProps) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const [activeFact, setActiveFact] = useState<StorylineFact | null>(null);

  useEffect(() => {
    if (!storyline?.facts) {
      setActiveFact(null);
      return;
    }

    const fact = storyline.facts.find(
      (f) => currentTime >= f.startTime && currentTime < f.endTime,
    );
    setActiveFact(fact ?? null);
  }, [currentTime, storyline]);

  if (!storyline?.facts?.length) return null;

  return (
    <AnimatePresence mode="wait">
      {activeFact && (
        <motion.div
          key={`${activeFact.startTime}-${activeFact.text.substring(0, 20)}`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mx-6 mt-3"
        >
          <div className="bg-white/[0.12] backdrop-blur-xl rounded-2xl p-4 border border-white/[0.08]">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 p-1.5 rounded-lg bg-white/[0.1] flex-shrink-0">
                <BookOpen size={14} className="text-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-white/90 leading-relaxed">
                  {activeFact.text}
                </p>
                {activeFact.source && (
                  <p className="text-[11px] text-white/40 mt-1.5">
                    — {activeFact.source}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
//  Example storyline data structure
//
//  In production, these would come from a JSON file or API:
//
//  const storylines: Record<string, TrackStoryline> = {
//    'track-id-123': {
//      trackId: 'track-id-123',
//      facts: [
//        { startTime: 0,  endTime: 15, text: 'This track was recorded in a single take.' },
//        { startTime: 30, endTime: 45, text: 'The guitar riff was inspired by Led Zeppelin.' },
//        { startTime: 80, endTime: 95, text: 'This chorus went viral on TikTok in 2023.', source: 'Billboard' },
//      ],
//    },
//  };
// ─────────────────────────────────────────────────────────────
