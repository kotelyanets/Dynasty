import { useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { Track, Playlist } from '@/types/music';
import { Play, Pause, MoreHorizontal, Heart, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { api, addTrackToPlaylist, getStoredLikedPlaylistId } from '@/services/api';

interface TrackRowProps {
  track: Track;
  index?: number;
  showCover?: boolean;
  showArtist?: boolean;
  showAlbum?: boolean;
  showTrackNumber?: boolean;
  queue?: Track[];
  isLiked?: boolean;
  onToggleLike?: (trackId: string) => void;
}

export function TrackRow({
  track,
  showCover = true,
  showArtist = true,
  showAlbum = false,
  showTrackNumber = false,
  queue,
  isLiked,
  onToggleLike,
}: TrackRowProps) {
  const { state, playTrack, togglePlay, formatTime } = usePlayer();
  const { isDownloaded, isDownloading, downloadTrack, removeDownload } = useOfflineCache();
  const isActive  = state.currentTrack?.id === track.id;
  const isPlaying = isActive && state.isPlaying;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPlaylists, setMenuPlaylists] = useState<Playlist[] | null>(null);

  const handleClick = () => {
    if (isActive) {
      togglePlay();
    } else {
      playTrack(track, queue, queue ? queue.findIndex(t => t.id === track.id) : 0);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative w-full flex items-center gap-3 px-4 py-2.5 rounded-[10px] group text-left touch-row"
    >
      {/* Track number or animated bars */}
      {showTrackNumber && (
        <div className="w-7 flex-shrink-0 text-center">
          {isActive ? (
            isPlaying ? (
              <div className="flex items-end justify-center gap-[2px] h-4">
                <div className="w-[3px] bg-[#fc3c44] rounded-full animate-[bar1_0.8s_ease-in-out_infinite]" style={{ height: '60%' }} />
                <div className="w-[3px] bg-[#fc3c44] rounded-full animate-[bar2_0.6s_ease-in-out_infinite]" style={{ height: '100%' }} />
                <div className="w-[3px] bg-[#fc3c44] rounded-full animate-[bar3_0.7s_ease-in-out_infinite]" style={{ height: '40%' }} />
              </div>
            ) : (
              <Pause size={14} className="text-[#fc3c44] mx-auto" />
            )
          ) : (
            <span className="text-[13px] text-white/40 tabular-nums">{track.trackNumber}</span>
          )}
        </div>
      )}

      {/* Cover art */}
      {showCover && (
        <div className="w-11 h-11 rounded-[8px] overflow-hidden flex-shrink-0 relative group shadow-sm">
          <img src={track.coverUrl} alt={track.album} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
            {isPlaying
              ? <Pause size={16} fill="white" strokeWidth={0} />
              : <Play  size={16} fill="white" strokeWidth={0} className="ml-0.5" />
            }
          </div>
        </div>
      )}

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] font-medium truncate ${isActive ? 'text-[#fc3c44]' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-[13px] text-white/50 truncate">
          {showArtist && track.artist}
          {showArtist && showAlbum && ' · '}
          {showAlbum && track.album}
        </p>
      </div>

      {/* Duration */}
      <span className="text-[13px] text-white/35 tabular-nums flex-shrink-0">
        {formatTime(track.duration)}
      </span>

      {/* Like button */}
      {onToggleLike && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(track.id);
          }}
          className="text-white/25 active:text-[#fc3c44] flex-shrink-0 p-1 active:scale-90 transition-all"
          aria-label={isLiked ? 'Remove from Liked Tracks' : 'Add to Liked Tracks'}
        >
          <Heart
            size={16}
            strokeWidth={1.75}
            fill={isLiked ? '#fc3c44' : 'none'}
            className={isLiked ? 'text-[#fc3c44]' : 'text-white/25'}
          />
        </button>
      )}

      {/* More button */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          const next = !showMenu;
          setShowMenu(next);
          if (next && menuPlaylists === null) {
            const all = await api.getPlaylists();
            const likedId = getStoredLikedPlaylistId();
            setMenuPlaylists(
              all.filter((p) => p.id !== likedId && p.name.toLowerCase() !== 'liked tracks'),
            );
          }
        }}
        className="text-white/25 active:text-white/60 flex-shrink-0 p-1 active:scale-90 transition-all"
        aria-label="More options"
      >
        <MoreHorizontal size={16} />
      </button>

      {/* Context menu */}
      {showMenu && (
        <div
          className="absolute right-3 top-full mt-1 z-30 rounded-[14px] overflow-hidden shadow-2xl py-1 min-w-[180px]"
          style={{ background: 'rgba(30,30,32,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {onToggleLike && (
            <button
              onClick={() => {
                onToggleLike(track.id);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-[14px] text-white/85 active:bg-white/[0.08] border-b border-white/[0.06]"
            >
              {isLiked ? 'Remove from Liked' : 'Add to Liked'}
            </button>
          )}
          {/* Download for offline */}
          {track.audioUrl && (
            <button
              onClick={async () => {
                if (isDownloaded(track.id)) {
                  await removeDownload(track);
                } else {
                  await downloadTrack(track);
                }
                setShowMenu(false);
              }}
              disabled={isDownloading(track.id)}
              className="w-full px-4 py-2.5 text-left text-[14px] text-white/85 active:bg-white/[0.08] border-b border-white/[0.06] flex items-center gap-2"
            >
              {isDownloading(track.id) ? (
                <>
                  <Loader2 size={14} className="animate-spin flex-shrink-0" />
                  Downloading…
                </>
              ) : isDownloaded(track.id) ? (
                <>
                  <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                  Remove Download
                </>
              ) : (
                <>
                  <Download size={14} className="flex-shrink-0" />
                  Download
                </>
              )}
            </button>
          )}
          {menuPlaylists && menuPlaylists.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1 text-[11px] text-white/35 uppercase tracking-wider">
                Add to Playlist
              </div>
              {menuPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => {
                    void addTrackToPlaylist(pl.id, track.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-[14px] text-white/85 active:bg-white/[0.08] last:border-0 border-b border-white/[0.06]"
                >
                  {pl.name}
                </button>
              ))}
            </>
          )}
          {!onToggleLike && menuPlaylists !== null && menuPlaylists.length === 0 && (
            <div className="px-4 py-2.5 text-[13px] text-white/40">
              No playlists yet
            </div>
          )}
        </div>
      )}
    </button>
  );
}
