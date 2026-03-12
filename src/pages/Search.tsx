import { useState } from 'react';
import { TrackRow } from '@/components/TrackRow';
import { useSearch } from '@/hooks/useSearch';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';

interface SearchProps {
  onNavigate: (view: string, id?: string) => void;
}

export function Search({ onNavigate }: SearchProps) {
  const [query, setQuery] = useState('');
  const { data: results, loading } = useSearch(query);
  const { isLiked, toggleLike } = useLikedTracks();

  const hasResults = results.tracks.length > 0 || results.albums.length > 0 || results.artists.length > 0;

  return (
    <div className="pb-4">
      <div className="px-5 pt-14 pb-2">
        <h1 className="text-3xl font-bold text-white mb-4">Search</h1>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artists, Songs, Albums..."
            className="w-full bg-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/15 transition-colors"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {!query.trim() && (
        <div className="px-5 mt-8 text-center">
          <SearchIcon size={48} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/30 text-sm">Search your music library</p>
        </div>
      )}

      {loading && query.trim() && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      )}

      {query.trim() && !loading && !hasResults && (
        <div className="px-5 mt-12 text-center">
          <p className="text-white/50 text-base font-medium">No results found</p>
          <p className="text-white/30 text-sm mt-1">Try a different search term</p>
        </div>
      )}

      {hasResults && (
        <div className="mt-4">
          {/* Artists */}
          {results.artists.length > 0 && (
            <section className="mb-6">
              <h3 className="px-5 text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Artists</h3>
              {results.artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => onNavigate('artist', artist.id)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden">
                    <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{artist.name}</p>
                    <p className="text-xs text-white/50">Artist · {artist.albumCount} albums</p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {/* Albums */}
          {results.albums.length > 0 && (
            <section className="mb-6">
              <h3 className="px-5 text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Albums</h3>
              {results.albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => onNavigate('album', album.id)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden">
                    <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{album.title}</p>
                    <p className="text-xs text-white/50">Album · {album.artist}</p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {/* Tracks */}
          {results.tracks.length > 0 && (
            <section className="mb-6">
              <h3 className="px-5 text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Songs</h3>
              <div className="px-1">
                {results.tracks.map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    queue={results.tracks}
                    isLiked={isLiked(track.id)}
                    onToggleLike={toggleLike}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
