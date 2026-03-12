/**
 * Library.tsx  (upgraded)
 * ─────────────────────────────────────────────────────────────
 * Changes:
 *  ✓ Songs tab now uses VirtualTrackList for large-library support
 *  ✓ Playlists tab — create/delete stored in localStorage via api.ts
 *  ✓ Sort controls on Songs tab (A-Z, Recently Added, Duration)
 */

import { useState, useMemo, useEffect } from 'react';
import { VirtualTrackList } from '@/components/VirtualTrackList';
import { api, getOrCreateLikedPlaylist, getStoredLikedPlaylistId } from '@/services/api';
import type { Playlist } from '@/types/music';
import { useTracks } from '@/hooks/useTracks';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';
import { Music, Disc3, Mic2, ListMusic, Plus, Trash2, ChevronRight, Loader2, Heart } from 'lucide-react';

interface LibraryProps {
  onNavigate: (view: string, id?: string) => void;
  /**
   * Optional hint from the parent about which tab / genre
   * should be initially focused (e.g. when tapping a genre
   * chip on the Home screen).
   */
  initialTab?: Tab;
  initialGenre?: string | null;
}

type Tab = 'songs' | 'albums' | 'artists' | 'playlists';
type SongSort = 'default' | 'az' | 'duration';

export function Library({ onNavigate, initialTab, initialGenre }: LibraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('songs');
  const [songSort, setSongSort] = useState<SongSort>('default');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedPlaylistId, setLikedPlaylistId] = useState<string | null>(getStoredLikedPlaylistId());
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [playlistActionError, setPlaylistActionError] = useState<string | null>(null);

  // ── Fetch real data from the backend ──────────────────────
  const { data: tracks, loading: tracksLoading, error: tracksError } = useTracks();
  const { data: albums, loading: albumsLoading, error: albumsError } = useAlbums();
  const { data: artists, loading: artistsLoading, error: artistsError } = useArtists();

  // Load playlists whenever the Playlists tab is active
  useEffect(() => {
    if (activeTab !== 'playlists') return;
    api.getPlaylists()
      .then(setPlaylists)
      .catch((e) => setPlaylistsError(e instanceof Error ? e.message : 'Failed to load playlists'));
  }, [activeTab]);

  // Apply initial tab / genre when provided by the parent.
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialGenre) {
      setActiveTab('albums');
      setGenreFilter(initialGenre);
    }
  }, [initialGenre]);

  const sortedTracks = useMemo(() => {
    if (songSort === 'az') {
      return [...tracks].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (songSort === 'duration') {
      return [...tracks].sort((a, b) => b.duration - a.duration);
    }
    return tracks;
  }, [tracks, songSort]);

  const uniqueAlbums = useMemo(() => {
    const seenIds = new Set<string>();
    const seenTitleCover = new Set<string>();
    return albums.filter((album) => {
      if (seenIds.has(album.id)) return false;
      seenIds.add(album.id);

      // Secondary dedup: same title + same cover URL ≈ same album
      // (catches duplicates created by inconsistent artist metadata)
      // Only apply when coverUrl is present to avoid incorrectly
      // grouping all cover-less albums together.
      if (album.coverUrl) {
        const key = `${album.title.trim().toLowerCase()}::${album.coverUrl}`;
        if (seenTitleCover.has(key)) return false;
        seenTitleCover.add(key);
      }

      return true;
    });
  }, [albums]);

  const visibleAlbums = useMemo(
    () => (genreFilter ? uniqueAlbums.filter((a) => a.genre === genreFilter) : uniqueAlbums),
    [uniqueAlbums, genreFilter],
  );

  const userPlaylists = useMemo(
    () => playlists.filter(
      (pl) => pl.id !== likedPlaylistId && pl.name.toLowerCase() !== 'liked tracks',
    ),
    [playlists, likedPlaylistId],
  );

  const tabs: { id: Tab; label: string; icon: typeof Music }[] = [
    { id: 'songs',     label: 'Songs',     icon: Music },
    { id: 'albums',    label: 'Albums',    icon: Disc3 },
    { id: 'artists',   label: 'Artists',   icon: Mic2 },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
  ];

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setPlaylistActionError(null);
    try {
      const pl = await api.createPlaylist(newPlaylistName.trim());
      setPlaylists((prev) => [...prev, pl]);
      setNewPlaylistName('');
      setShowCreate(false);
    } catch (e) {
      setPlaylistActionError(e instanceof Error ? e.message : 'Failed to create playlist');
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    setPlaylistActionError(null);
    try {
      await api.deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setPlaylistActionError(e instanceof Error ? e.message : 'Failed to delete playlist');
    }
  };

  return (
    <div className="pb-4">
      <div className="px-5 pt-14 pb-2">
        <h1 className="text-[34px] font-bold text-white mb-4">Library</h1>

        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all active:scale-95 ${
                activeTab === id
                  ? 'bg-[#fc3c44] text-white shadow-lg'
                  : 'bg-white/[0.1] text-white/60 active:bg-white/[0.15]'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Songs Tab ─────────────────────────────────────── */}
      {activeTab === 'songs' && (
        <div className="mt-2">
          {tracksLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#fc3c44]" />
            </div>
          )}
          {tracksError && (
            <div className="px-5 py-10 text-center">
              <p className="text-red-400 font-semibold">Failed to load tracks</p>
              <p className="text-white/40 text-[13px] mt-1">{tracksError.message}</p>
            </div>
          )}
          {!tracksLoading && !tracksError && (
            <>
              <div className="px-5 py-2 flex items-center justify-between">
                <p className="text-[13px] text-white/40">{tracks.length} songs</p>
                <div className="flex gap-1.5">
                  {(['default', 'az', 'duration'] as SongSort[]).map((s) => {
                    const labels: Record<SongSort, string> = {
                      default: 'Recent', az: 'A–Z', duration: 'Length',
                    };
                    return (
                      <button
                        key={s}
                        onClick={() => setSongSort(s)}
                        className={`text-[12px] px-3 py-1 rounded-full font-medium transition-colors ${
                          songSort === s
                            ? 'bg-white/[0.14] text-white'
                            : 'text-white/35 active:text-white/60'
                        }`}
                      >
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-1">
                <VirtualTrackList
                  tracks={sortedTracks}
                  queue={sortedTracks}
                  showCover
                  showArtist
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Albums Tab ────────────────────────────────────── */}
      {activeTab === 'albums' && (
        <div className="px-5 mt-4">
          {albumsLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#fc3c44]" />
            </div>
          )}
          {albumsError && (
            <div className="py-10 text-center">
              <p className="text-red-400 font-semibold">Failed to load albums</p>
              <p className="text-white/40 text-[13px] mt-1">{albumsError.message}</p>
            </div>
          )}
          {!albumsLoading && !albumsError && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] text-white/40">
                  {visibleAlbums.length} albums{genreFilter ? ` · ${genreFilter}` : ''}
                </p>
                {genreFilter && (
                  <button
                    onClick={() => setGenreFilter(null)}
                    className="text-[13px] text-[#fc3c44] font-medium active:opacity-60"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                {visibleAlbums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => onNavigate('album', album.id)}
                    className="text-left group active:scale-[0.97] transition-transform duration-150"
                  >
                    <div className="aspect-square rounded-[14px] overflow-hidden mb-2 shadow-xl">
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-[13px] font-semibold text-white truncate">{album.title}</p>
                    <p className="text-[12px] text-white/45 truncate">{album.artist} · {album.year}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Artists Tab ───────────────────────────────────── */}
      {activeTab === 'artists' && (
        <div className="mt-2">
          {artistsLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#fc3c44]" />
            </div>
          )}
          {artistsError && (
            <div className="px-5 py-10 text-center">
              <p className="text-red-400 font-semibold">Failed to load artists</p>
              <p className="text-white/40 text-[13px] mt-1">{artistsError.message}</p>
            </div>
          )}
          {!artistsLoading && !artistsError && (
            <>
              <div className="px-5 mb-1">
                <p className="text-[13px] text-white/40">{artists.length} artists</p>
              </div>
              {artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => onNavigate('artist', artist.id)}
                  className="w-full flex items-center gap-4 px-5 py-3 active:bg-white/[0.05] transition-colors"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden shadow-lg flex-shrink-0 ring-[0.5px] ring-white/10">
                    <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white truncate">{artist.name}</p>
                    <p className="text-[13px] text-white/45">
                      {artist.albumCount} album{artist.albumCount > 1 ? 's' : ''} · {artist.trackCount} songs
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Playlists Tab ─────────────────────────────────── */}
      {activeTab === 'playlists' && (
        <div className="mt-4 px-5">
          {/* ── Liked Tracks (pinned) ── */}
          {(() => {
            const likedPl = playlists.find(
              (p) => p.id === likedPlaylistId || p.name.toLowerCase() === 'liked tracks',
            );
            const songCount = likedPl?.trackIds.length ?? 0;
            const handleOpenLiked = async () => {
              if (likedPl) {
                onNavigate('playlist', likedPl.id);
              } else {
                const pl = await getOrCreateLikedPlaylist();
                setLikedPlaylistId(pl.id);
                setPlaylists((prev) => {
                  if (prev.find((p) => p.id === pl.id)) return prev;
                  return [pl, ...prev];
                });
                onNavigate('playlist', pl.id);
              }
            };
            return (
              <div
                onClick={() => void handleOpenLiked()}
                className="flex items-center gap-3.5 py-3 border-b border-white/[0.06] cursor-pointer active:bg-white/[0.04] transition-colors -mx-1 px-1 rounded-xl mb-1"
              >
                <div className="w-[52px] h-[52px] rounded-[12px] bg-gradient-to-br from-[#fc3c44]/60 to-[#7a001a]/80 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Heart size={22} className="text-white" fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-white truncate">Liked Tracks</p>
                  <p className="text-[12px] text-white/30">
                    {songCount} song{songCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
              </div>
            );
          })()}

          {/* Create button */}
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="w-full flex items-center gap-3 py-3 text-[#fc3c44] active:opacity-60 transition-opacity mb-2"
          >
            <div className="w-12 h-12 rounded-[12px] bg-white/[0.07] flex items-center justify-center">
              <Plus size={22} />
            </div>
            <span className="text-[17px] font-semibold">New Playlist</span>
          </button>

          {/* Inline create form */}
          {showCreate && (
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                placeholder="Playlist name…"
                autoFocus
                className="flex-1 bg-white/[0.1] rounded-[12px] px-4 py-2.5 text-[15px] text-white placeholder:text-white/30 outline-none focus:bg-white/[0.14] transition-colors"
              />
              <button
                onClick={handleCreatePlaylist}
                className="px-4 py-2.5 bg-[#fc3c44] rounded-[12px] text-[15px] font-semibold text-white active:scale-95 transition-transform"
              >
                Create
              </button>
            </div>
          )}

          {/* Error feedback */}
          {playlistActionError && (
            <p className="text-[13px] text-red-400 mb-3 px-1">{playlistActionError}</p>
          )}
          {playlistsError && (
            <p className="text-[13px] text-red-400 mb-3 px-1">{playlistsError}</p>
          )}

          {/* User playlists (excluding Liked Tracks) */}
          {userPlaylists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onNavigate('playlist', pl.id)}
                className="flex items-center gap-3.5 py-3 border-b border-white/[0.06] last:border-0 cursor-pointer active:bg-white/[0.04] transition-colors -mx-1 px-1 rounded-xl"
              >
                <div className="w-[52px] h-[52px] rounded-[12px] bg-gradient-to-br from-[#fc3c44]/50 to-[#a00016]/70 flex items-center justify-center flex-shrink-0 shadow-md">
                  <ListMusic size={22} className="text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-white truncate">{pl.name}</p>
                  {pl.description && (
                    <p className="text-[13px] text-white/40 truncate">{pl.description}</p>
                  )}
                  <p className="text-[12px] text-white/30">
                    {pl.trackIds.length} song{pl.trackIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeletePlaylist(pl.id);
                  }}
                  className="p-2 text-white/20 active:text-red-400 transition-colors"
                  aria-label={`Delete ${pl.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

          {/* Empty state for user playlists */}
          {userPlaylists.length === 0 && !showCreate && (
            <div className="text-center mt-6">
              <p className="text-white/35 text-[14px]">Tap "New Playlist" to create a playlist</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
