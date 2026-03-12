import { usePlayer } from '@/context/PlayerContext';
import { useArtistDetail } from '@/hooks/useArtistDetail';
import { TrackRow } from '@/components/TrackRow';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { ChevronLeft, Play, Shuffle, Loader2 } from 'lucide-react';

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
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="pt-20 px-5 text-center">
        <p className="text-red-400 font-medium mb-2">
          {error ? 'Failed to load artist' : 'Artist not found'}
        </p>
        {error && <p className="text-white/40 text-sm">{error.message}</p>}
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

  const handlePlayAll = () => {
    if (allArtistTracks.length > 0) {
      playTrack(allArtistTracks[0], allArtistTracks, 0);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...allArtistTracks].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) {
      playTrack(shuffled[0], shuffled, 0);
    }
  };

  return (
    <div className="pb-4">
      {/* Back button */}
      <div className="fixed top-0 left-0 right-0 z-30 px-2 pt-12 pb-2 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-rose-400 active:opacity-50 transition-opacity"
        >
          <ChevronLeft size={24} />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      {/* Artist Header */}
      <div className="relative pt-16 px-5 pb-6">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={artist.imageUrl}
            className="w-full h-full object-cover scale-125 blur-2xl opacity-30"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black" />
        </div>

        <div className="relative text-center pt-4">
          <div className="w-36 h-36 mx-auto rounded-full overflow-hidden shadow-2xl mb-4 ring-2 ring-white/20">
            <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white">{artist.name}</h1>
          <p className="text-sm text-white/50 mt-1">
            {artist.albumCount} album{artist.albumCount > 1 ? 's' : ''} · {artist.trackCount} songs
          </p>

          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-8 py-2.5 bg-rose-500 rounded-full active:scale-95 transition-transform"
            >
              <Play size={18} fill="white" />
              <span className="text-sm font-semibold text-white">Play</span>
            </button>
            <button
              onClick={handleShuffle}
              className="flex items-center gap-2 px-8 py-2.5 bg-white/10 rounded-full active:scale-95 transition-transform"
            >
              <Shuffle size={16} className="text-rose-400" />
              <span className="text-sm font-semibold text-white">Shuffle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Songs */}
      <section className="mt-2">
        <h2 className="px-5 text-lg font-bold text-white mb-2">Top Songs</h2>
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
      <section className="mt-8">
        <h2 className="px-5 text-lg font-bold text-white mb-3">Albums</h2>
        <div className="px-5">
          {artist.albums.map((album) => (
            <button
              key={album.id}
              onClick={() => onNavigate('album', album.id)}
              className="w-full flex items-center gap-4 py-3 border-b border-white/5 last:border-0 active:opacity-70 transition-opacity text-left"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{album.title}</p>
                <p className="text-xs text-white/50">{album.year} · {album.trackCount} songs</p>
              </div>
              <ChevronLeft size={16} className="text-white/20 rotate-180 flex-shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
