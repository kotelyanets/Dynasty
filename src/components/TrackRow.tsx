import { useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { Track } from '@/types/music';
import { Play, Pause, MoreHorizontal, Heart } from 'lucide-react';

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
  const isActive = state.currentTrack?.id === track.id;
  const isPlaying = isActive && state.isPlaying;
  const [showMenu, setShowMenu] = useState(false);

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
      className="relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg group text-left touch-row"
    >
      {/* Track number or cover */}
      {showTrackNumber && (
        <div className="w-7 flex-shrink-0 text-center">
          {isActive ? (
            isPlaying ? (
              <div className="flex items-end justify-center gap-[2px] h-4">
                <div className="w-[3px] bg-rose-500 rounded-full animate-[bar1_0.8s_ease-in-out_infinite]" style={{height: '60%'}} />
                <div className="w-[3px] bg-rose-500 rounded-full animate-[bar2_0.6s_ease-in-out_infinite]" style={{height: '100%'}} />
                <div className="w-[3px] bg-rose-500 rounded-full animate-[bar3_0.7s_ease-in-out_infinite]" style={{height: '40%'}} />
              </div>
            ) : (
              <Pause size={14} className="text-rose-500 mx-auto" />
            )
          ) : (
            <span className="text-sm text-white/40 tabular-nums">{track.trackNumber}</span>
          )}
        </div>
      )}

      {showCover && (
        <div className="w-11 h-11 rounded-md overflow-hidden flex-shrink-0 relative group">
          <img src={track.coverUrl} alt={track.album} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
            {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" className="ml-0.5" />}
          </div>
        </div>
      )}

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-rose-500' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-xs text-white/50 truncate">
          {showArtist && track.artist}
          {showArtist && showAlbum && ' · '}
          {showAlbum && track.album}
        </p>
      </div>

      {/* Duration */}
      <span className="text-xs text-white/40 tabular-nums flex-shrink-0">
        {formatTime(track.duration)}
      </span>

      {/* Like button (optional) */}
      {onToggleLike && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(track.id);
          }}
          className="text-white/30 active:text-rose-400 flex-shrink-0 p-1 active:scale-90 transition-all"
          aria-label={isLiked ? 'Remove from Liked Tracks' : 'Add to Liked Tracks'}
        >
          <Heart size={16} fill={isLiked ? '#fb7185' : 'none'} className={isLiked ? 'text-rose-400' : 'text-white/30'} />
        </button>
      )}

      {/* More button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((v) => !v);
        }}
        className="text-white/30 active:text-white/60 flex-shrink-0 p-1 active:scale-90 transition-all"
        aria-label="More options"
      >
        <MoreHorizontal size={16} />
      </button>

      {showMenu && (
        <div
          className="absolute right-3 top-full mt-1 z-30 rounded-xl bg-black/90 border border-white/10 shadow-xl py-1 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          {onToggleLike && (
            <button
              onClick={() => {
                onToggleLike(track.id);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-xs text-white/80 active:bg-white/10"
            >
              {isLiked ? 'Remove from Liked Tracks' : 'Add to Liked Tracks'}
            </button>
          )}
          {!onToggleLike && (
            <div className="px-3 py-2 text-[11px] text-white/40">
              More actions coming soon
            </div>
          )}
        </div>
      )}
    </button>
  );
}
