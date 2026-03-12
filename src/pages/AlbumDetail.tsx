import { useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { TrackRow } from '@/components/TrackRow';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { useAlbumDetail } from '@/hooks/useAlbumDetail';
import { ChevronLeft, Play, Shuffle, Ellipsis, Loader2 } from 'lucide-react';

interface AlbumDetailProps {
  albumId: string;
  onBack: () => void;
  onNavigate: (view: string, id?: string) => void;
}

export function AlbumDetail({ albumId, onBack, onNavigate }: AlbumDetailProps) {
  const { data: album, loading, error } = useAlbumDetail(albumId);
  const { playTrack, formatTime } = usePlayer();
  const { isLiked, toggleLike } = useLikedTracks();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="pt-20 px-5 text-center">
        <p className="text-red-400 font-medium mb-2">
          {error ? 'Failed to load album' : 'Album not found'}
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

  const totalDuration = album.tracks.reduce((acc, t) => acc + t.duration, 0);

  const handlePlayAll = () => {
    if (album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks, 0);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
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

      {/* Album Header */}
      <div className="pt-20 px-5 pb-4 text-center">
        <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden shadow-2xl mb-5">
          <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
        </div>
        <h1 className="text-xl font-bold text-white">{album.title}</h1>
        <button
          onClick={() => onNavigate('artist', album.artistId)}
          className="text-rose-400 text-sm font-medium mt-1 active:opacity-50"
        >
          {album.artist}
        </button>
        <p className="text-xs text-white/40 mt-1">
          {album.genre} · {album.year} · {album.trackCount} songs, {formatTime(totalDuration)}
        </p>

        {/* Play & Shuffle buttons */}
        <div className="flex items-center justify-center gap-3 mt-5 relative">
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
          <button
            onClick={() => setShowMoreMenu((v) => !v)}
            className="p-2.5 text-white/50 active:opacity-50"
            aria-label="More options"
          >
            <Ellipsis size={22} />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-2 z-30 w-48 rounded-xl bg-black/90 border border-white/10 shadow-2xl py-1 text-left">
              <button
                onClick={() => {
                  // Like/unlike all tracks in this album
                  album.tracks.forEach((t) => toggleLike(t.id));
                  setShowMoreMenu(false);
                }}
                className="w-full px-3 py-2 text-sm text-white/80 active:bg-white/10"
              >
                Toggle like for all songs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Track List */}
      <div className="px-1 mt-2">
        {album.tracks.map((track, i) => (
          <TrackRow
            key={track.id}
            track={track}
            index={i}
            showCover={false}
            showArtist={false}
            showTrackNumber
            queue={album.tracks}
            isLiked={isLiked(track.id)}
            onToggleLike={toggleLike}
          />
        ))}
      </div>

      {/* Footer info */}
      <div className="px-5 mt-6 text-center">
        <p className="text-xs text-white/30">
          {album.trackCount} songs · {Math.floor(totalDuration / 60)} minutes
        </p>
        <p className="text-xs text-white/20 mt-1">
          © {album.year} {album.artist}
        </p>
      </div>
    </div>
  );
}
