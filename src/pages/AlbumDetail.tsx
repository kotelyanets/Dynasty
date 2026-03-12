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
        <Loader2 className="w-10 h-10 animate-spin text-[#fc3c44]" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="pt-20 px-5 text-center">
        <p className="text-red-400 font-semibold mb-2">
          {error ? 'Failed to load album' : 'Album not found'}
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

  const totalDuration = album.tracks.reduce((acc, t) => acc + t.duration, 0);

  const handlePlayAll = () => {
    if (album.tracks.length > 0) playTrack(album.tracks[0], album.tracks, 0);
  };

  const handleShuffle = () => {
    const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) playTrack(shuffled[0], shuffled, 0);
  };

  return (
    <div className="pb-4">
      {/* Gradient header background */}
      <div className="absolute top-0 left-0 right-0 h-80 overflow-hidden -z-0">
        <img
          src={album.coverUrl}
          className="w-full h-full object-cover blur-3xl scale-150 opacity-50 saturate-150"
          alt=""
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
      </div>

      {/* Back button */}
      <div className="fixed top-0 left-0 right-0 z-30 px-2 pt-14 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#fc3c44] active:opacity-50 transition-opacity"
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
          <span className="text-[17px] font-medium">Back</span>
        </button>
      </div>

      {/* Album Header */}
      <div className="relative pt-24 px-5 pb-6 text-center z-10">
        <div className="w-[220px] h-[220px] mx-auto rounded-[20px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] mb-5">
          <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
        </div>
        <h1 className="text-[22px] font-bold text-white leading-snug">{album.title}</h1>
        <button
          onClick={() => onNavigate('artist', album.artistId)}
          className="text-[17px] text-[#fc3c44] font-medium mt-0.5 active:opacity-50"
        >
          {album.artist}
        </button>
        <p className="text-[13px] text-white/40 mt-1.5">
          {album.genre} · {album.year} · {album.trackCount} songs, {formatTime(totalDuration)}
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 mt-5 relative">
          <button
            onClick={handlePlayAll}
            className="flex items-center justify-center gap-2 flex-1 max-w-[160px] py-3 bg-[#fc3c44] rounded-full active:scale-95 transition-transform shadow-lg"
          >
            <Play size={18} fill="white" strokeWidth={0} />
            <span className="text-[15px] font-semibold text-white">Play</span>
          </button>
          <button
            onClick={handleShuffle}
            className="flex items-center justify-center gap-2 flex-1 max-w-[160px] py-3 bg-white/[0.1] rounded-full active:scale-95 transition-transform"
          >
            <Shuffle size={16} className="text-[#fc3c44]" />
            <span className="text-[15px] font-semibold text-white">Shuffle</span>
          </button>
          <button
            onClick={() => setShowMoreMenu((v) => !v)}
            className="p-2.5 text-white/50 active:opacity-50"
            aria-label="More options"
          >
            <Ellipsis size={22} />
          </button>

          {showMoreMenu && (
            <div
              className="absolute right-0 top-full mt-2 z-30 w-48 rounded-2xl overflow-hidden shadow-2xl py-1 text-left"
              style={{ background: 'rgba(30,30,32,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
            >
              <button
                onClick={() => {
                  album.tracks.forEach((t) => toggleLike(t.id));
                  setShowMoreMenu(false);
                }}
                className="w-full px-4 py-3 text-[14px] text-white/90 active:bg-white/10 text-left"
              >
                Toggle Like for All Songs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Track List */}
      <div className="relative z-10 px-1">
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

      {/* Footer */}
      <div className="relative z-10 px-5 mt-6 text-center">
        <p className="text-[12px] text-white/25">
          {album.trackCount} songs · {Math.floor(totalDuration / 60)} minutes
        </p>
        <p className="text-[12px] text-white/20 mt-1">© {album.year} {album.artist}</p>
      </div>
    </div>
  );
}
