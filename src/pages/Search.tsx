import { useState } from 'react';
import { TrackRow } from '@/components/TrackRow';
import { useSearch } from '@/hooks/useSearch';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { Search as SearchIcon, X, Loader2, ChevronRight } from 'lucide-react';

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
      {/* Header */}
      <div className="px-5 pt-14 pb-3">
        <h1 className="text-[34px] font-bold text-white mb-4">Search</h1>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artists, Songs, Albums..."
            className="w-full bg-white/[0.1] rounded-[12px] pl-10 pr-10 py-2.5 text-[15px] text-white placeholder:text-white/35 outline-none focus:bg-white/[0.14] transition-colors"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 active:text-white/70"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!query.trim() && (
        <div className="px-5 mt-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.07] flex items-center justify-center mx-auto mb-4">
            <SearchIcon size={28} className="text-white/25" />
          </div>
          <p className="text-white/40 text-[15px] font-medium">Search your music library</p>
        </div>
      )}

      {loading && query.trim() && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#fc3c44]" />
        </div>
      )}

      {query.trim() && !loading && !hasResults && (
        <div className="px-5 mt-12 text-center">
          <p className="text-white/60 text-[17px] font-semibold">No results for "{query}"</p>
          <p className="text-white/35 text-[14px] mt-1.5">Try a different search term</p>
        </div>
      )}

      {hasResults && (
        <div className="mt-2">
          {/* Artists */}
          {results.artists.length > 0 && (
            <section className="mb-6">
              <h3 className="px-5 text-[20px] font-bold text-white mb-2">Artists</h3>
              {results.artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => onNavigate('artist', artist.id)}
                  className="w-full flex items-center gap-3.5 px-5 py-2.5 active:bg-white/[0.06] transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-[0.5px] ring-white/10">
                    <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-white truncate">{artist.name}</p>
                    <p className="text-[13px] text-white/50">Artist · {artist.albumCount} albums</p>
                  </div>
                  <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                </button>
              ))}
            </section>
          )}

          {/* Albums */}
          {results.albums.length > 0 && (
            <section className="mb-6">
              <h3 className="px-5 text-[20px] font-bold text-white mb-2">Albums</h3>
              {results.albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => onNavigate('album', album.id)}
                  className="w-full flex items-center gap-3.5 px-5 py-2.5 active:bg-white/[0.06] transition-colors"
                >
                  <div className="w-12 h-12 rounded-[10px] overflow-hidden flex-shrink-0 shadow-md">
                    <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-white truncate">{album.title}</p>
                    <p className="text-[13px] text-white/50">Album · {album.artist}</p>
                  </div>
                  <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                </button>
              ))}
            </section>
          )}

          {/* Songs */}
          {results.tracks.length > 0 && (
            <section className="mb-6">
              <h3 className="px-5 text-[20px] font-bold text-white mb-2">Songs</h3>
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
