import { useState, useMemo } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';
import { useTracks } from '@/hooks/useTracks';
import type { Album, Artist, Track } from '@/types/music';
import { Play, Loader2 } from 'lucide-react';

interface HomeProps {
  onNavigate: (view: string, id?: string) => void;
}

function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 w-[150px] text-left group active:scale-95 transition-transform duration-150">
      <div className="w-[150px] h-[150px] rounded-[14px] overflow-hidden mb-2.5 shadow-xl relative">
        <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-end justify-end p-2">
          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity shadow-lg">
            <Play size={16} fill="black" strokeWidth={0} />
          </div>
        </div>
      </div>
      <p className="text-[13px] font-semibold text-white truncate leading-snug">{album.title}</p>
      <p className="text-[12px] text-white/50 truncate">{album.artist}</p>
    </button>
  );
}

function ArtistBubble({ artist, onClick }: { artist: Artist; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 w-[90px] text-center group active:scale-95 transition-transform duration-150">
      <div className="w-[90px] h-[90px] rounded-full overflow-hidden mb-2 shadow-lg mx-auto ring-[0.5px] ring-white/10">
        <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
      </div>
      <p className="text-[12px] font-medium text-white truncate">{artist.name}</p>
    </button>
  );
}

export function Home({ onNavigate }: HomeProps) {
  const { playTrack } = usePlayer();

  const { data: albums, loading: albumsLoading } = useAlbums();
  const { data: artists, loading: artistsLoading } = useArtists();
  const { data: tracks, loading: tracksLoading } = useTracks();

  const isLoading = albumsLoading || artistsLoading || tracksLoading;

  const [seed] = useState(() => Math.random());

  const recentAlbums   = useMemo(() => [...albums].sort(() => seed - 0.5).slice(0, 10), [albums, seed]);
  const featuredAlbums = useMemo(() => [...albums].sort(() => (seed + 0.3) - 0.5).slice(0, 10), [albums, seed]);
  const featuredArtists = useMemo(() => artists.slice(0, 8), [artists]);

  const quickPicks = useMemo(
    () => [...tracks].sort(() => seed - 0.5).slice(0, 6),
    [tracks, seed],
  );

  const genres = useMemo(() => [...new Set(albums.map((a) => a.genre))], [albums]);

  const handleQuickPlay = (track: Track) => {
    playTrack(track, quickPicks, quickPicks.indexOf(track));
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="pb-4">
      {/* ── Header ── */}
      <div className="px-5 pt-14 pb-3">
        <p className="text-[15px] font-semibold text-[#fc3c44] mb-0.5">{greeting()}</p>
        <h1 className="text-[34px] font-bold text-white leading-tight">Listen Now</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-[#fc3c44]" />
        </div>
      ) : (
        <>
          {/* ── Quick Picks ── */}
          {quickPicks.length > 0 && (
            <section className="px-5 mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[22px] font-bold text-white">Quick Picks</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickPicks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => handleQuickPlay(track)}
                    className="flex items-center gap-3 bg-white/[0.07] rounded-[12px] overflow-hidden active:bg-white/[0.12] active:scale-[0.98] transition-all duration-150"
                  >
                    <img src={track.coverUrl} alt="" className="w-14 h-14 object-cover flex-shrink-0 rounded-l-[12px]" />
                    <div className="flex-1 min-w-0 pr-2 py-1">
                      <p className="text-[13px] font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-white/50 truncate">{track.artist}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Recently Added ── */}
          {recentAlbums.length > 0 && (
            <section className="mb-8">
              <div className="px-5 mb-3 flex items-baseline justify-between">
                <h2 className="text-[22px] font-bold text-white">Recently Added</h2>
                <button
                  className="text-[15px] text-[#fc3c44] font-medium active:opacity-60 transition-opacity"
                  onClick={() => onNavigate('library')}
                >
                  See All
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto px-5 pb-1 scrollbar-hide snap-x snap-mandatory" style={{ scrollSnapType: 'x mandatory' }}>
                {recentAlbums.map((album) => (
                  <div key={album.id} className="snap-start" style={{ scrollSnapAlign: 'start' }}>
                    <AlbumCard album={album} onClick={() => onNavigate('album', album.id)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Your Artists ── */}
          {featuredArtists.length > 0 && (
            <section className="mb-8">
              <div className="px-5 mb-3 flex items-baseline justify-between">
                <h2 className="text-[22px] font-bold text-white">Your Artists</h2>
              </div>
              <div className="flex gap-5 overflow-x-auto px-5 pb-1 scrollbar-hide snap-x snap-mandatory" style={{ scrollSnapType: 'x mandatory' }}>
                {featuredArtists.map((artist) => (
                  <div key={artist.id} className="snap-start" style={{ scrollSnapAlign: 'start' }}>
                    <ArtistBubble artist={artist} onClick={() => onNavigate('artist', artist.id)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── New Music ── */}
          {featuredAlbums.length > 0 && (
            <section className="mb-8">
              <div className="px-5 mb-3 flex items-baseline justify-between">
                <h2 className="text-[22px] font-bold text-white">New Music</h2>
                <button
                  className="text-[15px] text-[#fc3c44] font-medium active:opacity-60 transition-opacity"
                  onClick={() => onNavigate('library')}
                >
                  See All
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto px-5 pb-1 scrollbar-hide snap-x snap-mandatory" style={{ scrollSnapType: 'x mandatory' }}>
                {featuredAlbums.map((album) => (
                  <div key={album.id} className="snap-start" style={{ scrollSnapAlign: 'start' }}>
                    <AlbumCard album={album} onClick={() => onNavigate('album', album.id)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Library Stats ── */}
          <div className="px-5 mb-8">
            <div className="rounded-[18px] p-5 bg-white/[0.05]">
              <h3 className="text-[12px] font-semibold text-white/50 uppercase tracking-wider mb-4">Your Library</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[28px] font-bold text-white leading-none">{tracks.length}</p>
                  <p className="text-[12px] text-white/40 mt-1">Songs</p>
                </div>
                <div className="text-center">
                  <p className="text-[28px] font-bold text-white leading-none">{albums.length}</p>
                  <p className="text-[12px] text-white/40 mt-1">Albums</p>
                </div>
                <div className="text-center">
                  <p className="text-[28px] font-bold text-white leading-none">{artists.length}</p>
                  <p className="text-[12px] text-white/40 mt-1">Artists</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Browse by Genre ── */}
          {genres.length > 0 && (
            <section className="mb-4">
              <div className="px-5 mb-3">
                <h2 className="text-[22px] font-bold text-white">Browse Genres</h2>
              </div>
              <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 scrollbar-hide snap-x snap-mandatory" style={{ scrollSnapType: 'x mandatory' }}>
                {genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => onNavigate('library', genre)}
                    className="flex-shrink-0 px-5 py-2.5 rounded-full bg-white/[0.09] border border-white/[0.1] active:bg-white/[0.15] active:scale-95 transition-all duration-150 snap-start"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <p className="text-[14px] font-semibold text-white whitespace-nowrap">{genre}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
