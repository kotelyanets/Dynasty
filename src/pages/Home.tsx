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
    <button onClick={onClick} className="flex-shrink-0 w-[160px] text-left group">
      <div className="w-[160px] h-[160px] rounded-xl overflow-hidden mb-2 shadow-lg relative">
        <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center">
          <Play size={32} fill="white" className="text-white" />
        </div>
      </div>
      <p className="text-[13px] font-semibold text-white truncate">{album.title}</p>
      <p className="text-[12px] text-white/50 truncate">{album.artist}</p>
    </button>
  );
}

function ArtistBubble({ artist, onClick }: { artist: Artist; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 w-[110px] text-center group">
      <div className="w-[110px] h-[110px] rounded-full overflow-hidden mb-2 shadow-lg mx-auto">
        <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
      </div>
      <p className="text-[12px] font-semibold text-white truncate">{artist.name}</p>
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

  const recentAlbums = useMemo(
    () => [...albums].sort(() => seed - 0.5).slice(0, 8),
    [albums, seed],
  );

  const featuredArtists = useMemo(() => artists.slice(0, 6), [artists]);

  const quickPicks = useMemo(
    () => [...tracks].sort(() => seed - 0.5).slice(0, 6),
    [tracks, seed],
  );

  const genres = useMemo(
    () => [...new Set(albums.map((a) => a.genre))],
    [albums],
  );

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
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-3xl font-bold text-white">{greeting()}</h1>
        <p className="text-white/50 text-sm mt-1">Your personal music vault</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
        </div>
      ) : (
        <>
          {/* Quick Pick Grid */}
          {quickPicks.length > 0 && (
            <div className="px-5 mb-8">
              <div className="grid grid-cols-2 gap-2.5">
                {quickPicks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => handleQuickPlay(track)}
                    className="flex items-center gap-3 bg-white/8 rounded-lg overflow-hidden active:bg-white/15 transition-colors"
                  >
                    <img src={track.coverUrl} alt="" className="w-12 h-12 object-cover" />
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-[12px] font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[10px] text-white/50 truncate">{track.artist}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Albums */}
          {recentAlbums.length > 0 && (
            <section className="mb-8">
              <div className="px-5 mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Recently Added</h2>
                <button className="text-rose-400 text-sm font-medium" onClick={() => onNavigate('library')}>
                  See All
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide">
                {recentAlbums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => onNavigate('album', album.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Featured Artists */}
          {featuredArtists.length > 0 && (
            <section className="mb-8">
              <div className="px-5 mb-3">
                <h2 className="text-xl font-bold text-white">Your Artists</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide">
                {featuredArtists.map((artist) => (
                  <ArtistBubble
                    key={artist.id}
                    artist={artist}
                    onClick={() => onNavigate('artist', artist.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Stats */}
          <div className="px-5 mb-8">
            <div className="bg-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Your Library</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{tracks.length}</p>
                  <p className="text-xs text-white/40">Songs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{albums.length}</p>
                  <p className="text-xs text-white/40">Albums</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{artists.length}</p>
                  <p className="text-xs text-white/40">Artists</p>
                </div>
              </div>
            </div>
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <section className="mb-8">
              <div className="px-5 mb-3">
                <h2 className="text-xl font-bold text-white">Browse by Genre</h2>
              </div>
              <div className="flex gap-2.5 overflow-x-auto px-5 pb-2 scrollbar-hide">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => onNavigate('library', genre)}
                    className="flex-shrink-0 px-5 py-3 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 active:bg-white/15 transition-colors"
                  >
                    <p className="text-sm font-semibold text-white whitespace-nowrap">{genre}</p>
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
