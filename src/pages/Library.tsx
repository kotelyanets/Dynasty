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
import { api } from '@/services/api';
import type { Playlist } from '@/types/music';
import { useTracks } from '@/hooks/useTracks';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';
import { Music, Disc3, Mic2, ListMusic, Plus, Trash2, ChevronRight, Loader2 } from 'lucide-react';

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
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // ── Fetch real data from the backend ──────────────────────
  const { data: tracks, loading: tracksLoading, error: tracksError } = useTracks();
  const { data: albums, loading: albumsLoading, error: albumsError } = useAlbums();
  const { data: artists, loading: artistsLoading, error: artistsError } = useArtists();

  // Load playlists on mount
  useEffect(() => {
    api.getPlaylists().then(setPlaylists).catch(console.error);
  }, []);

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
    const seen = new Set<string>();
    return albums.filter((album) => {
      if (seen.has(album.id)) return false;
      seen.add(album.id);
      return true;
    });
  }, [albums]);

  const visibleAlbums = useMemo(
    () => (genreFilter ? uniqueAlbums.filter((a) => a.genre === genreFilter) : uniqueAlbums),
    [uniqueAlbums, genreFilter],
  );

  const tabs: { id: Tab; label: string; icon: typeof Music }[] = [
    { id: 'songs',     label: 'Songs',     icon: Music },
    { id: 'albums',    label: 'Albums',    icon: Disc3 },
    { id: 'artists',   label: 'Artists',   icon: Mic2 },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
  ];

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const pl = await api.createPlaylist(newPlaylistName.trim());
      setPlaylists((prev) => [...prev, pl]);
      setNewPlaylistName('');
      setShowCreate(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      await api.deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="pb-4">
      <div className="px-5 pt-14 pb-2">
        <h1 className="text-3xl font-bold text-white mb-4">Library</h1>

        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === id
                  ? 'bg-rose-500 text-white'
                  : 'bg-white/10 text-white/60 active:bg-white/15'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Songs Tab ────────────────────────────────────── */}
      {activeTab === 'songs' && (
        <div className="mt-2">
          {tracksLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
          )}
          {tracksError && (
            <div className="px-5 py-10 text-center">
              <p className="text-red-400 font-medium">Failed to load tracks</p>
              <p className="text-white/40 text-sm mt-1">{tracksError.message}</p>
            </div>
          )}
          {!tracksLoading && !tracksError && (
            <>
              <div className="px-5 py-2 flex items-center justify-between">
                <p className="text-sm text-white/40">
                  {tracks.length} songs
                </p>
            {/* Sort control */}
            <div className="flex gap-1.5">
              {(['default', 'az', 'duration'] as SongSort[]).map((s) => {
                const labels: Record<SongSort, string> = {
                  default: 'Recent', az: 'A–Z', duration: 'Length',
                };
                return (
                  <button
                    key={s}
                    onClick={() => setSongSort(s)}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                      songSort === s
                        ? 'bg-white/15 text-white'
                        : 'text-white/30 active:text-white/60'
                    }`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/*
            VirtualTrackList handles the DOM virtualization.
            Only ~12-15 rows are mounted at any given time.
          */}
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

      {/* ── Albums Tab ───────────────────────────────────── */}
      {activeTab === 'albums' && (
        <div className="px-5 mt-4">
          {albumsLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
          )}
          {albumsError && (
            <div className="py-10 text-center">
              <p className="text-red-400 font-medium">Failed to load albums</p>
              <p className="text-white/40 text-sm mt-1">{albumsError.message}</p>
            </div>
          )}
          {!albumsLoading && !albumsError && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-white/40">
                  {visibleAlbums.length} albums
                  {genreFilter ? ` · ${genreFilter}` : ''}
                </p>
                {genreFilter && (
                  <button
                    onClick={() => setGenreFilter(null)}
                    className="text-xs text-white/50 active:text-white/80 underline-offset-2"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {visibleAlbums.map((album) => (
              <button
                key={album.id}
                onClick={() => onNavigate('album', album.id)}
                className="text-left group active:opacity-70 transition-opacity"
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-2 shadow-lg">
                  <img
                    src={album.coverUrl}
                    alt={album.title}
                    className="w-full h-full object-cover group-active:scale-95 transition-transform duration-200"
                    loading="lazy"
                  />
                </div>
                <p className="text-[13px] font-semibold text-white truncate">{album.title}</p>
                <p className="text-[12px] text-white/50 truncate">
                  {album.artist} · {album.year}
                </p>
              </button>
            ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Artists Tab ──────────────────────────────────── */}
      {activeTab === 'artists' && (
        <div className="mt-2">
          {artistsLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
          )}
          {artistsError && (
            <div className="px-5 py-10 text-center">
              <p className="text-red-400 font-medium">Failed to load artists</p>
              <p className="text-white/40 text-sm mt-1">{artistsError.message}</p>
            </div>
          )}
          {!artistsLoading && !artistsError && (
            <>
              <div className="px-5">
                <p className="text-sm text-white/40 mb-3">{artists.length} artists</p>
              </div>
              {artists.map((artist) => (
            <button
              key={artist.id}
              onClick={() => onNavigate('artist', artist.id)}
              className="w-full flex items-center gap-4 px-5 py-3 active:bg-white/8 transition-colors"
            >
              <div className="w-14 h-14 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-base font-semibold text-white truncate">{artist.name}</p>
                <p className="text-sm text-white/50">
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

      {/* ── Playlists Tab ────────────────────────────────── */}
      {activeTab === 'playlists' && (
        <div className="mt-4 px-5">
          {/* Create button */}
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="w-full flex items-center gap-3 py-3 text-rose-400 active:opacity-60 transition-opacity mb-2"
          >
            <div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center">
              <Plus size={22} />
            </div>
            <span className="text-base font-semibold">New Playlist</span>
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
                className="flex-1 bg-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/15 transition-colors"
              />
              <button
                onClick={handleCreatePlaylist}
                className="px-4 py-2.5 bg-rose-500 rounded-xl text-sm font-semibold text-white active:scale-95 transition-transform"
              >
                Create
              </button>
            </div>
          )}

          {/* Playlist list */}
          {playlists.length === 0 && !showCreate && (
            <div className="text-center mt-8">
              <ListMusic size={48} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/50 font-medium">No Playlists Yet</p>
              <p className="text-white/30 text-sm mt-1">
                Tap "New Playlist" to organize your music
              </p>
            </div>
          )}

          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => onNavigate('playlist', pl.id)}
              className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 cursor-pointer active:bg-white/5 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/40 to-rose-900/60 flex items-center justify-center flex-shrink-0">
                <ListMusic size={20} className="text-white/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white truncate">{pl.name}</p>
                {pl.description && (
                  <p className="text-sm text-white/40 truncate">{pl.description}</p>
                )}
                <p className="text-xs text-white/30">
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
        </div>
      )}
    </div>
  );
}
