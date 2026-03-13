import { useEffect, useMemo, useState } from 'react';
import { useTracks } from '@/hooks/useTracks';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { api, addTrackToPlaylist, removeTrackFromPlaylist, getStoredLikedPlaylistId } from '@/services/api';
import type { Playlist, Track } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { ChevronLeft, Loader2, Play, Plus, Trash2, Heart } from 'lucide-react';
import { TrackRow } from '@/components/TrackRow';

interface PlaylistDetailProps {
  playlistId: string;
  onBack: () => void;
  onNavigate: (view: string, id?: string) => void;
}

export function PlaylistDetail({ playlistId, onBack }: PlaylistDetailProps) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddSongs, setShowAddSongs] = useState(false);

  const { data: allTracks, loading: tracksLoading } = useTracks();
  const { playTrack } = usePlayer();
  const { isLiked, toggleLike } = useLikedTracks();

  const likedPlaylistId = getStoredLikedPlaylistId();
  const isLikedPlaylist =
    playlistId === likedPlaylistId || playlist?.name.toLowerCase() === 'liked tracks';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .getPlaylist(playlistId)
      .then((found) => {
        if (!mounted) return;
        if (!found) setError('Playlist not found');
        setPlaylist(found);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [playlistId]);

  const playlistTracks: Track[] = useMemo(() => {
    if (!playlist) return [];
    const byId = new Map<string, Track>();
    for (const t of allTracks) byId.set(t.id, t);
    return playlist.trackIds
      .map((id) => byId.get(id))
      .filter((t): t is Track => !!t);
  }, [allTracks, playlist]);

  const availableToAdd = useMemo(() => {
    if (!playlist) return [];
    const existing = new Set(playlist.trackIds);
    return allTracks.filter((t) => !existing.has(t.id));
  }, [allTracks, playlist]);

  const handlePlay = () => {
    if (playlistTracks.length === 0) return;
    playTrack(playlistTracks[0], playlistTracks, 0);
  };

  const handleAddTrack = async (trackId: string) => {
    if (!playlist) return;
    if (playlist.trackIds.includes(trackId)) return;
    setSaving(true);
    try {
      await addTrackToPlaylist(playlist.id, trackId);
      setPlaylist((prev) =>
        prev ? { ...prev, trackIds: [...prev.trackIds, trackId] } : prev,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist) return;
    setSaving(true);
    try {
      if (isLikedPlaylist) {
        // For the Liked Tracks playlist, removing = unliking the track
        await toggleLike(trackId);
      } else {
        await removeTrackFromPlaylist(playlist.id, trackId);
      }
      setPlaylist((prev) =>
        prev ? { ...prev, trackIds: prev.trackIds.filter((id) => id !== trackId) } : prev,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || tracksLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="pt-20 px-5 text-center">
        <p className="text-red-400 font-medium mb-2">{error ?? 'Playlist not found'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 bg-white/10 rounded-full text-sm text-white active:scale-95 transition-transform"
        >
          Go Back
        </button>
      </div>
    );
  }

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

      {/* Header */}
      <div className="pt-20 px-5 pb-4 text-left">
        <div className={`w-40 h-40 rounded-2xl overflow-hidden shadow-2xl mb-5 flex items-center justify-center ${
          isLikedPlaylist
            ? 'bg-gradient-to-br from-[#fc3c44]/60 to-[#7a001a]/80'
            : 'bg-gradient-to-br from-rose-500/60 to-rose-900/80'
        }`}>
          {isLikedPlaylist ? (
            <Heart size={60} className="text-white" fill="white" />
          ) : (
            <span className="text-4xl">🎵</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white" style={{
          fontSize: playlist.name.length > 30 ? '1.25rem' : playlist.name.length > 20 ? '1.5rem' : '1.75rem',
          lineHeight: 1.2,
        }}>{playlist.name}</h1>
        {playlist.description && (
          <p className="text-white/60 mt-1" style={{
            fontSize: (playlist.description?.length ?? 0) > 100 ? '0.75rem' : (playlist.description?.length ?? 0) > 50 ? '0.8125rem' : '0.875rem',
            lineHeight: 1.5,
          }}>{playlist.description}</p>
        )}
        <p className="text-xs text-white/40 mt-1">
          {playlist.trackIds.length} song{playlist.trackIds.length !== 1 ? 's' : ''}
          {playlist.createdAt && (() => {
            const updated = new Date(playlist.createdAt);
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return ' · Updated today';
            if (diffDays === 1) return ' · Updated yesterday';
            if (diffDays < 7) return ` · Updated ${diffDays} days ago`;
            return '';
          })()}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handlePlay}
            disabled={playlistTracks.length === 0}
            className="flex items-center gap-2 px-8 py-2.5 bg-rose-500 rounded-full active:scale-95 transition-transform disabled:opacity-50"
          >
            <Play size={18} fill="white" />
            <span className="text-sm font-semibold text-white">Play</span>
          </button>
          {!isLikedPlaylist && (
            <button
              onClick={() => setShowAddSongs((v) => !v)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white/10 rounded-full active:scale-95 transition-transform"
            >
              <Plus size={16} className="text-rose-400" />
              <span className="text-sm font-semibold text-white">
                {showAddSongs ? 'Done' : 'Add Songs'}
              </span>
            </button>
          )}
          {saving && <Loader2 className="w-4 h-4 animate-spin text-white/70" />}
        </div>
      </div>

      {/* Track List */}
      <div className="px-1 mt-2">
        {playlistTracks.length === 0 && !showAddSongs && (
          <p className="px-4 py-4 text-sm text-white/50">
            This playlist is empty. Tap &quot;Add Songs&quot; to start adding music.
          </p>
        )}

        {playlistTracks.map((track) => (
          <div key={track.id} className="flex items-center">
            <div className="flex-1">
              <TrackRow
                track={track}
                showCover
                showArtist
                showAlbum={false}
                queue={playlistTracks}
                isLiked={isLiked(track.id)}
                onToggleLike={toggleLike}
              />
            </div>
            <button
              onClick={() => void handleRemoveTrack(track.id)}
              className="mr-3 text-white/30 active:text-red-400 p-1.5"
              aria-label="Remove from playlist"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add songs panel */}
      {showAddSongs && (
        <div className="mt-4 px-5 pb-6">
          <p className="text-sm font-semibold text-white mb-2">Add songs</p>
          <p className="text-xs text-white/40 mb-3">
            Tap a song to add it to this playlist. Songs already in the playlist are hidden.
          </p>
          <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-hide">
            {availableToAdd.map((track) => (
              <button
                key={track.id}
                onClick={() => void handleAddTrack(track.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 active:bg-white/10 text-left"
              >
                <img
                  src={track.coverUrl}
                  alt={track.album}
                  className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{track.title}</p>
                  <p className="text-xs text-white/50 truncate">
                    {track.artist} · {track.album}
                  </p>
                </div>
                <Plus size={16} className="text-rose-400 flex-shrink-0" />
              </button>
            ))}
            {availableToAdd.length === 0 && (
              <p className="text-xs text-white/40">All songs are already in this playlist.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

