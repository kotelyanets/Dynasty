import { useRef, useCallback, useEffect, useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useArtistDetail } from '@/hooks/useArtistDetail';
import { TrackRow } from '@/components/TrackRow';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { ChevronLeft, Play, Shuffle, Loader2, ChevronRight } from 'lucide-react';

interface ArtistDetailProps {
  artistId: string;
  onBack: () => void;
  onNavigate: (view: string, id?: string) => void;
}

export function ArtistDetail({ artistId, onBack, onNavigate }: ArtistDetailProps) {
  const { data: artist, loading, error } = useArtistDetail(artistId);
  const { playTrack } = usePlayer();
  const { isLiked, toggleLike } = useLikedTracks();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-[#fc3c44]" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="pt-20 px-5 text-center">
        <p className="text-red-400 font-semibold mb-2">
          {error ? 'Failed to load artist' : 'Artist not found'}
        </p>
        {error && <p className="text-white/40 text-[13px]">{error.message}</p>}
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 bg-white/10 rounded-full text-sm text-white active:scale-95 transition-transform"
        >
          Go Back
        </button>
      </div>
    );
  }

  const allArtistTracks = artist.albums.flatMap((a) => a.tracks);
  const topTracks = allArtistTracks.slice(0, 5);

  // ── Parallax state ─────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [heroScale, setHeroScale] = useState(1);
  const [heroBlur, setHeroBlur] = useState(0);
  const [heroOpacity, setHeroOpacity] = useState(1);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollY = el.scrollTop;
    if (scrollY < 0) {
      // Overscroll (pull down) — zoom in
      const scale = 1 + Math.abs(scrollY) / 300;
      setHeroScale(Math.min(scale, 1.5));
      setHeroBlur(0);
      setHeroOpacity(1);
    } else {
      // Scroll down — blur and fade
      setHeroScale(1);
      const blur = Math.min(scrollY / 30, 20);
      const opacity = Math.max(1 - scrollY / 400, 0.3);
      setHeroBlur(blur);
      setHeroOpacity(opacity);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handlePlayAll = () => {
    if (allArtistTracks.length > 0) playTrack(allArtistTracks[0], allArtistTracks, 0);
  };

  const handleShuffle = () => {
    const shuffled = [...allArtistTracks].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) playTrack(shuffled[0], shuffled, 0);
  };

  return (
    <div ref={scrollRef} className="pb-4 h-full overflow-y-auto overscroll-y-contain">
      {/* Back button */}
      <div className="fixed top-0 left-0 right-0 z-30 px-2 pt-14 pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#fc3c44] active:opacity-50 transition-opacity"
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
          <span className="text-[17px] font-medium">Back</span>
        </button>
      </div>

      {/* Artist Header */}
      <div className="relative pt-0">
        {/* Background image with parallax */}
        <div
          className="absolute inset-0 h-[300px] overflow-hidden"
          style={{ position: 'sticky', top: 0, zIndex: 0 }}
        >
          <img
            src={artist.imageUrl}
            className="w-full h-full object-cover transition-[filter] duration-100"
            alt=""
            aria-hidden="true"
            style={{
              transform: `scale(${heroScale})`,
              filter: `blur(${heroBlur}px)`,
              opacity: heroOpacity,
              transformOrigin: 'center center',
              willChange: 'transform, filter, opacity',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black" />
        </div>

        <div className="relative pt-28 px-5 pb-6 text-center">
          <div className="w-[130px] h-[130px] mx-auto rounded-full overflow-hidden shadow-2xl mb-4 ring-2 ring-white/[0.15]">
            <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-[28px] font-bold text-white">{artist.name}</h1>
          <p className="text-[14px] text-white/50 mt-1">
            {artist.albumCount} album{artist.albumCount > 1 ? 's' : ''} · {artist.trackCount} songs
          </p>

          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={handlePlayAll}
              className="flex items-center justify-center gap-2 flex-1 max-w-[150px] py-3 bg-[#fc3c44] rounded-full active:scale-95 transition-transform shadow-lg"
            >
              <Play size={18} fill="white" strokeWidth={0} />
              <span className="text-[15px] font-semibold text-white">Play</span>
            </button>
            <button
              onClick={handleShuffle}
              className="flex items-center justify-center gap-2 flex-1 max-w-[150px] py-3 bg-white/[0.1] rounded-full active:scale-95 transition-transform"
            >
              <Shuffle size={16} className="text-[#fc3c44]" />
              <span className="text-[15px] font-semibold text-white">Shuffle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Songs */}
      <section className="mt-2">
        <h2 className="px-5 text-[20px] font-bold text-white mb-1">Top Songs</h2>
        <div className="px-1">
          {topTracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              queue={allArtistTracks}
              isLiked={isLiked(track.id)}
              onToggleLike={toggleLike}
            />
          ))}
        </div>
      </section>

      {/* Albums */}
      <section className="mt-7 mb-4">
        <h2 className="px-5 text-[20px] font-bold text-white mb-3">Albums</h2>
        <div>
          {artist.albums.map((album) => (
            <button
              key={album.id}
              onClick={() => onNavigate('album', album.id)}
              className="w-full flex items-center gap-4 px-5 py-3 border-b border-white/[0.05] last:border-0 active:bg-white/[0.04] transition-colors text-left"
            >
              <div className="w-[60px] h-[60px] rounded-[10px] overflow-hidden shadow-lg flex-shrink-0">
                <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-white truncate">{album.title}</p>
                <p className="text-[13px] text-white/45">{album.year} · {album.trackCount} songs</p>
              </div>
              <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
