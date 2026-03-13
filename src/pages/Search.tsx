import { useState, useCallback } from 'react';
import { TrackRow } from '@/components/TrackRow';
import { useSearch } from '@/hooks/useSearch';
import { useAlbums } from '@/hooks/useAlbums';
import { useLikedTracks } from '@/hooks/useLikedTracks';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { Search as SearchIcon, X, Loader2, ChevronRight, Mic, MicOff } from 'lucide-react';

interface SearchProps {
  onNavigate: (view: string, id?: string) => void;
}

export function Search({ onNavigate }: SearchProps) {
  const [query, setQuery] = useState('');
  const { data: results, loading } = useSearch(query);
  const { data: albums } = useAlbums();
  const { isLiked, toggleLike } = useLikedTracks();

  const onVoiceResult = useCallback((text: string) => {
    setQuery(text);
  }, []);
  const { listening, supported: voiceSupported, start: startVoice, stop: stopVoice } = useVoiceSearch(onVoiceResult);

  const hasResults = results.tracks.length > 0 || results.albums.length > 0 || results.artists.length > 0;

  // Derive browse categories from album genres
  const genreColors: Record<string, string> = {
    'Rock':        'from-[#d63384] to-[#6f42c1]',
    'Pop':         'from-[#e91e63] to-[#ff5722]',
    'Hip-Hop':     'from-[#ff9800] to-[#f44336]',
    'R&B':         'from-[#9c27b0] to-[#3f51b5]',
    'Electronic':  'from-[#00bcd4] to-[#2196f3]',
    'Jazz':        'from-[#795548] to-[#ff9800]',
    'Classical':   'from-[#607d8b] to-[#455a64]',
    'Country':     'from-[#8bc34a] to-[#4caf50]',
    'Metal':       'from-[#424242] to-[#212121]',
    'Folk':        'from-[#a1887f] to-[#6d4c41]',
    'Indie':       'from-[#26c6da] to-[#00838f]',
    'Alternative': 'from-[#7e57c2] to-[#4527a0]',
    'Soul':        'from-[#ff7043] to-[#bf360c]',
    'Reggae':      'from-[#66bb6a] to-[#2e7d32]',
    'Blues':       'from-[#42a5f5] to-[#1565c0]',
    'Punk':        'from-[#ef5350] to-[#b71c1c]',
    'Latin':       'from-[#ffa726] to-[#e65100]',
    'Dance':       'from-[#ab47bc] to-[#6a1b9a]',
  };
  const defaultGradient = 'from-[#fc3c44] to-[#c2185b]';

  const genres = [...new Set(albums.map((a) => a.genre).filter(Boolean))];


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
            placeholder="Artists, Songs, Lyrics, Albums..."
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
          {!query && voiceSupported && (
            <button
              onClick={() => listening ? stopVoice() : startVoice()}
              className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                listening ? 'text-[#fc3c44] animate-pulse' : 'text-white/40 active:text-white/70'
              }`}
              aria-label={listening ? 'Stop voice search' : 'Voice search'}
            >
              {listening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          )}
        </div>
      </div>

      {/* Browse categories when no query */}
      {!query.trim() && (
        <div className="px-5 mt-4">
          <h2 className="text-[22px] font-bold text-white mb-3">Browse Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => onNavigate('library', genre)}
                className={`relative h-[110px] rounded-[14px] overflow-hidden bg-gradient-to-br ${genreColors[genre] ?? defaultGradient} active:scale-[0.97] transition-transform duration-150 text-left`}
              >
                <span className="absolute top-3 left-3.5 text-[18px] font-bold text-white drop-shadow-sm">
                  {genre}
                </span>
              </button>
            ))}
          </div>
          {genres.length === 0 && (
            <div className="text-center mt-8">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.07] flex items-center justify-center mx-auto mb-4">
                <SearchIcon size={28} className="text-white/25" />
              </div>
              <p className="text-white/40 text-[15px] font-medium">Search your music library</p>
            </div>
          )}
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
