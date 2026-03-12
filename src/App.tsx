/**
 * App.tsx
 * ─────────────────────────────────────────────────────────────
 * Root component.
 *
 * Key upgrade: useAudioEngine() is called once inside AppContent so
 * the HTMLAudioElement event listeners are registered exactly once
 * for the lifetime of the application.
 *
 * The audio keeps playing when the user switches tabs, navigates
 * to different pages, or even minimises the app on iOS (background
 * audio via the Web Audio API / MediaSession lock-screen controls).
 */

import { useState, useCallback } from 'react';
import { PlayerProvider } from '@/context/PlayerContext';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { MiniPlayer } from '@/components/MiniPlayer';
import { NowPlaying } from '@/components/NowPlaying';
import { Home } from '@/pages/Home';
import { Search } from '@/pages/Search';
import { Library } from '@/pages/Library';
import { AlbumDetail } from '@/pages/AlbumDetail';
import { ArtistDetail } from '@/pages/ArtistDetail';
import { PlaylistDetail } from '@/pages/PlaylistDetail';
import { usePlayerStore } from '@/store/playerStore';
import { Home as HomeIcon, Search as SearchIcon, Library as LibraryIcon } from 'lucide-react';

interface NavState {
  view: string;
  id?: string;
  history: { view: string; id?: string }[];
}

// ─────────────────────────────────────────────────────────────
//  App shell
// ─────────────────────────────────────────────────────────────

function AppContent() {
  // ── Mount the audio engine ONCE ─────────────────────────
  // This registers all HTMLAudioElement event listeners and the
  // Zustand subscription that keeps audioEl in sync with the store.
  useAudioEngine();

  const [nav, setNav] = useState<NavState>({ view: 'home', history: [] });

  // Read directly from Zustand (bypasses context) for a single
  // boolean check — avoids re-rendering the entire tree on every
  // time-update tick.
  const hasTrack = usePlayerStore((s) => !!s.currentTrack);
  const showNowPlaying = usePlayerStore((s) => s.showNowPlaying);

  const navigate = useCallback((view: string, id?: string) => {
    setNav((prev) => ({
      view,
      id,
      history: [...prev.history, { view: prev.view, id: prev.id }],
    }));
  }, []);

  const goBack = useCallback(() => {
    setNav((prev) => {
      const history = [...prev.history];
      const last = history.pop();
      if (!last) return prev;
      return { view: last.view, id: last.id, history };
    });
  }, []);

  const switchTab = useCallback((view: string) => {
    setNav({ view, history: [] });
  }, []);

  const tabs = [
    { id: 'home',    label: 'Home',    icon: HomeIcon },
    { id: 'search',  label: 'Search',  icon: SearchIcon },
    { id: 'library', label: 'Library', icon: LibraryIcon },
  ];

  // Determine which root tab is "active" (follows breadcrumb history)
  const activeTab = nav.history.length > 0 ? nav.history[0].view : nav.view;

  return (
    <div className="h-[100dvh] flex flex-col bg-black text-white overflow-hidden">
      {/* ── Scrollable page content ── */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide">
        {/*
          paddingBottom = fixed bar height + env(safe-area-inset-bottom).
          MiniPlayer (~60px) + TabBar (~56px) + safe area = ~116/60 + safe area.
          Using calc so iPhone home indicator never clips content.
        */}
        <div
          style={{
            paddingBottom: hasTrack
              ? 'calc(132px + env(safe-area-inset-bottom, 0px))'
              : 'calc(84px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {nav.view === 'home' && <Home onNavigate={navigate} />}
          {nav.view === 'search' && <Search onNavigate={navigate} />}
          {nav.view === 'library' && (
            <Library
              onNavigate={navigate}
              initialTab={nav.id ? 'albums' : 'songs'}
              initialGenre={nav.id ?? null}
            />
          )}
          {nav.view === 'album' && nav.id && (
            <AlbumDetail albumId={nav.id} onBack={goBack} onNavigate={navigate} />
          )}
          {nav.view === 'artist' && nav.id && (
            <ArtistDetail artistId={nav.id} onBack={goBack} onNavigate={navigate} />
          )}
          {nav.view === 'playlist' && nav.id && (
            <PlaylistDetail playlistId={nav.id} onBack={goBack} onNavigate={navigate} />
          )}
        </div>
      </main>

      {/* ── Fixed bottom bar: glass bg + mini-player + tabs ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-2xl backdrop-saturate-150 border-t border-white/10"
        style={{ WebkitBackdropFilter: 'blur(40px) saturate(180%)', backdropFilter: 'blur(40px) saturate(180%)' }}
      >
        {hasTrack && <MiniPlayer />}

        <nav
          className="flex items-center justify-around px-6 pt-1"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-label="Main navigation"
        >
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-4 transition-all duration-200 active:scale-90 ${
                  isActive ? 'text-rose-500' : 'text-white/40'
                }`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Full-screen Now Playing overlay ── */}
      {showNowPlaying && <NowPlaying onNavigate={navigate} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Root export
// ─────────────────────────────────────────────────────────────

export function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
