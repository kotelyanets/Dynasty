/**
 * MusicReplay.tsx — "Apple Music Replay" Stats Component
 * ─────────────────────────────────────────────────────────────
 * Shows Instagram Stories-style cards with listening statistics:
 * "Your top artist", "You played this track 45 times", etc.
 *
 * Uses framer-motion for smooth entry animations.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, TrendingUp, Clock, Disc, ChevronLeft, ChevronRight } from 'lucide-react';

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

interface TopTrack {
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string;
  playCount: number;
}

interface TopArtist {
  name: string;
  imageUrl: string;
  playCount: number;
}

interface TopGenre {
  genre: string;
  count: number;
}

interface Stats {
  period: string;
  totalListens: number;
  totalMinutes: number;
  topTracks: TopTrack[];
  topArtists: TopArtist[];
  topGenres: TopGenre[];
}

export function MusicReplay() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [cardIndex, setCardIndex] = useState(0);

  useEffect(() => {
    if (!BASE_URL) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${BASE_URL}/api/play-history/stats?period=${period}`)
      .then((res) => res.json())
      .then((data) => {
        setStats(data as Stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#fc3c44] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats || stats.totalListens === 0) {
    return (
      <div className="text-center py-12 px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.07] flex items-center justify-center mx-auto mb-4">
          <Music size={28} className="text-white/25" />
        </div>
        <p className="text-white/60 text-[17px] font-semibold">No listening data yet</p>
        <p className="text-white/35 text-[14px] mt-1.5">Start playing music to see your stats</p>
      </div>
    );
  }

  const cards = [
    // Card 1: Overview
    {
      gradient: 'from-[#fc3c44] to-[#c2185b]',
      content: (
        <div className="text-center">
          <TrendingUp size={40} className="mx-auto mb-4 text-white/80" />
          <h3 className="text-[24px] font-bold text-white mb-2">Your Replay</h3>
          <motion.p
            className="text-[48px] font-black text-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            {stats.totalListens}
          </motion.p>
          <p className="text-white/70 text-[16px]">tracks played</p>
          <motion.p
            className="text-[28px] font-bold text-white mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {stats.totalMinutes} min
          </motion.p>
          <p className="text-white/70 text-[14px]">of listening time</p>
        </div>
      ),
    },
    // Card 2: Top Artist
    ...(stats.topArtists.length > 0
      ? [{
          gradient: 'from-[#9c27b0] to-[#6a1b9a]',
          content: (
            <div className="text-center">
              <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 ring-2 ring-white/20">
                <img
                  src={stats.topArtists[0].imageUrl.startsWith('http')
                    ? stats.topArtists[0].imageUrl
                    : `${BASE_URL}${stats.topArtists[0].imageUrl}`}
                  alt={stats.topArtists[0].name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-white/60 text-[14px] mb-1">YOUR TOP ARTIST</p>
              <motion.h3
                className="text-[28px] font-bold text-white"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {stats.topArtists[0].name}
              </motion.h3>
              <motion.p
                className="text-white/70 text-[16px] mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {stats.topArtists[0].playCount} plays
              </motion.p>
            </div>
          ),
        }]
      : []),
    // Card 3: Top Track
    ...(stats.topTracks.length > 0
      ? [{
          gradient: 'from-[#ff5722] to-[#e64a19]',
          content: (
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg">
                <img
                  src={stats.topTracks[0].coverUrl.startsWith('http')
                    ? stats.topTracks[0].coverUrl
                    : `${BASE_URL}${stats.topTracks[0].coverUrl}`}
                  alt={stats.topTracks[0].title}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-white/60 text-[14px] mb-1">YOUR TOP TRACK</p>
              <motion.h3
                className="text-[22px] font-bold text-white"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {stats.topTracks[0].title}
              </motion.h3>
              <p className="text-white/50 text-[14px] mt-1">{stats.topTracks[0].artist}</p>
              <motion.p
                className="text-[32px] font-black text-white mt-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.3 }}
              >
                {stats.topTracks[0].playCount}×
              </motion.p>
              <p className="text-white/60 text-[14px]">times played</p>
            </div>
          ),
        }]
      : []),
    // Card 4: Top Genres
    ...(stats.topGenres.length > 0
      ? [{
          gradient: 'from-[#00bcd4] to-[#006064]',
          content: (
            <div className="text-center">
              <Disc size={40} className="mx-auto mb-4 text-white/80" />
              <p className="text-white/60 text-[14px] mb-3">YOUR TOP GENRES</p>
              <div className="space-y-3">
                {stats.topGenres.slice(0, 5).map((g, i) => (
                  <motion.div
                    key={g.genre}
                    className="flex items-center justify-between px-6"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span className="text-white font-semibold text-[16px]">{g.genre}</span>
                    <span className="text-white/60 text-[14px]">{g.count} plays</span>
                  </motion.div>
                ))}
              </div>
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div className="px-5">
      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {(['month', 'year', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setCardIndex(0); }}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
              period === p
                ? 'bg-[#fc3c44] text-white'
                : 'bg-white/[0.08] text-white/60'
            }`}
          >
            {p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Story-style cards carousel */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {cards[cardIndex] && (
            <motion.div
              key={cardIndex}
              className={`rounded-3xl bg-gradient-to-br ${cards[cardIndex].gradient} p-8 min-h-[340px] flex items-center justify-center`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              {cards[cardIndex].content}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation arrows */}
        {cards.length > 1 && (
          <div className="flex justify-center gap-4 mt-4">
            <button
              onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
              disabled={cardIndex === 0}
              className="w-10 h-10 rounded-full bg-white/[0.1] flex items-center justify-center disabled:opacity-30 transition-opacity"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === cardIndex ? 'bg-[#fc3c44] scale-110' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setCardIndex((i) => Math.min(cards.length - 1, i + 1))}
              disabled={cardIndex === cards.length - 1}
              className="w-10 h-10 rounded-full bg-white/[0.1] flex items-center justify-center disabled:opacity-30 transition-opacity"
            >
              <ChevronRight size={20} className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Top tracks list */}
      {stats.topTracks.length > 1 && (
        <div className="mt-8">
          <h3 className="text-[20px] font-bold text-white mb-3">
            <Clock size={18} className="inline mr-2 opacity-60" />
            Most Played
          </h3>
          <div className="space-y-2">
            {stats.topTracks.slice(0, 10).map((track, i) => (
              <motion.div
                key={track.trackId}
                className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/[0.04]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="text-white/30 text-[14px] font-bold w-6 text-right">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={track.coverUrl.startsWith('http') ? track.coverUrl : `${BASE_URL}${track.coverUrl}`}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-white font-medium truncate">{track.title}</p>
                  <p className="text-[12px] text-white/50 truncate">{track.artist}</p>
                </div>
                <span className="text-white/40 text-[13px] font-medium">{track.playCount}×</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
