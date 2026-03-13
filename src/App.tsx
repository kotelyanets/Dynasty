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
 *
 * ── Critical guarantees (do NOT remove) ─────────────────────
 *
 * 1. AUDIO ENGINE
 *    useAudioEngine() below wires the singleton HTMLAudioElement
 *    (exported from playerStore.ts) to all its DOM events. Chunked
 *    streaming (Range headers) is handled automatically by the browser
 *    because audioEl.src is set directly to the /api/stream/:id URL.
 *
 * 1b. MEDIA SESSION
 *    useMediaSession() subscribes to the Zustand player store and
 *    bridges track metadata / position / transport actions to the OS
 *    lock-screen controls (Control Center, AirPods, CarPlay, etc.).
 *
 * 2. API URL
 *    All backend calls in api.ts read BASE_URL from VITE_API_URL
 *    (your .env file, e.g. your Tailscale IP). Nothing here is
 *    hardcoded to localhost.
 *
 * 3. SAFE AREA
 *    index.html sets viewport-fit=cover so env(safe-area-inset-bottom)
 *    returns the real iPhone notch/home-indicator height.
 *    • Tab bar:       style={{ paddingBottom: 'max(env(...), 8px)' }}
 *    • Content area:  style={{ paddingBottom: 'calc(Npx + env(...))' }}
 *    Both values account for safe area — see comments inline below.
 */

import { useState, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { PlayerProvider } from '@/context/PlayerContext';
import { ToastProvider } from '@/context/ToastContext';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useMediaSession } from '@/hooks/useMediaSession';
import { useSnippetFromUrl } from '@/hooks/useSnippetSharing';
import { usePlayHistory } from '@/hooks/usePlayHistory';
import { useSeekTracking } from '@/hooks/useSeekTracking';
import { useGaplessPlayback } from '@/hooks/useGaplessPlayback';
import { useDynamicTheme } from '@/hooks/useDynamicTheme';
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
import { LayoutGroup, AnimatePresence } from 'framer-motion';
import { haptic } from '@/utils/haptics';

interface NavState {
  view: string;
  id?: string;
  history: { view: string; id?: string }[];
}

// ─────────────────────────────────────────────────────────────
//  Error Boundary — prevents a white/black screen of death
// ─────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <p className="text-white/70 text-lg font-medium">Something went wrong</p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            className="px-6 py-2 bg-[#fc3c44] text-white rounded-full text-sm font-semibold active:opacity-70"
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
//  App shell
// ─────────────────────────────────────────────────────────────

/** Views that require a valid `id` parameter. */
const DETAIL_VIEWS = ['album', 'artist', 'playlist'];

function AppContent() {
  // ── Mount the audio engine ONCE ─────────────────────────
  // This registers all HTMLAudioElement event listeners and the
  // Zustand subscription that keeps audioEl in sync with the store.
  useAudioEngine();

  // ── Mount the MediaSession bridge ONCE ─────────────────
  // This subscribes to store changes and keeps the OS lock-screen
  // controls (artwork, title, play/pause, seek) in sync.
  useMediaSession();

  // ── Read ?t= and ?track= from URL for snippet sharing ──
  useSnippetFromUrl();

  // ── Record play history for stats (Feature 6) ─────────────
  usePlayHistory();

  // ── Track seek events for heatmap (Feature 7) ─────────────
  useSeekTracking();

  // ── Pre-load next track for gapless playback (Feature 8) ──
  useGaplessPlayback();

  // ── Dynamic theme colors from album art (Feature 10) ──────
  useDynamicTheme();

  const [nav, setNav] = useState<NavState>({ view: 'home', history: [] });

  // ── Safety: reset to 'home' if a detail view loses its ID ──
  useEffect(() => {
    if (DETAIL_VIEWS.includes(nav.view) && !nav.id) {
      setNav({ view: 'home', history: [] });
    }
  }, [nav.view, nav.id]);

  // Read directly from Zustand (bypasses context) for a single
  // boolean check — avoids re-rendering the entire tree on every
  // time-update tick.
  const hasTrack = usePlayerStore((s) => !!s.currentTrack);
  const showNowPlaying = usePlayerStore((s) => s.showNowPlaying);

  const navigate = useCallback((view: string, id?: string) => {
    // Prevent navigating to detail views without an ID (causes black screen)
    if (DETAIL_VIEWS.includes(view) && !id) return;

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
    { id: 'home',    label: 'Listen Now', icon: HomeIcon },
    { id: 'search',  label: 'Search',     icon: SearchIcon },
    { id: 'library', label: 'Library',    icon: LibraryIcon },
  ];

  // Determine which root tab is "active" (follows breadcrumb history)
  const activeTab = nav.history.length > 0 ? nav.history[0].view : nav.view;

  return (
    <div className="h-[100dvh] flex flex-col bg-black text-white overflow-hidden">
      {/* ── Scrollable page content ── */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide">
        <ErrorBoundary onReset={() => switchTab('home')}>
        {/*
          SAFE-AREA GUARANTEE
          ────────────────────────────────────────────────────────────
          The fixed bottom zone height is:
            • Tab bar ≈ 1px border + 6px pt + ~40px buttons + max(safe-area, 6px) pb
            • MiniPlayer ≈ 84px (when a track is active)
          The content padding must mirror the tab bar's
          max(env(safe-area-inset-bottom), 6px) so the last list item
          is never clipped on notched or non-notched devices.
          `viewport-fit=cover` in index.html is required for env() to
          return a non-zero value on notched iPhones.
        */}
        <div
          style={{
            paddingBottom: hasTrack
              ? 'calc(160px + max(env(safe-area-inset-bottom, 0px), 6px))'
              : 'calc(52px + max(env(safe-area-inset-bottom, 0px), 6px))',
          }}
        >
          {nav.view === 'home' && <Home onNavigate={navigate} />}
          {nav.view === 'search' && <Search onNavigate={navigate} />}
          {nav.view === 'library' && (
            <Library
              onNavigate={navigate}
              initialTab={nav.id ? 'albums' : undefined}
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
          {/* Fallback: if view doesn't match any route or detail view has no ID, show Home */}
          {!['home', 'search', 'library'].includes(nav.view) &&
           !(DETAIL_VIEWS.includes(nav.view) && nav.id) && (
            <Home onNavigate={navigate} />
          )}
        </div>
        </ErrorBoundary>
      </main>

      {/* ── Floating mini player (above tab bar) ── */}
      <LayoutGroup>
        {hasTrack && !showNowPlaying && <MiniPlayer />}
      </LayoutGroup>

      {/* ── Fixed bottom: tab bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        {/* Tab bar
            SAFE-AREA GUARANTEE: paddingBottom uses max(env(safe-area-inset-bottom, 0px), 6px)
            so the iPhone home-indicator swipe area is always cleared.
            The fallback of 6px ensures minimum padding on non-notched devices. */}
        <div
          className="bg-black/80 backdrop-blur-3xl border-t border-white/[0.08]"
          style={{ WebkitBackdropFilter: 'blur(40px)', backdropFilter: 'blur(40px)' }}
        >
          <nav
            className="flex items-center justify-around px-2 pt-1.5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
            aria-label="Main navigation"
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => { haptic(); switchTab(id); }}
                  className={`flex flex-col items-center gap-0.5 py-0.5 px-5 transition-all duration-200 active:scale-90 ${
                    isActive ? 'text-[#fc3c44]' : 'text-[#8e8e93]'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={22} strokeWidth={1.5} fill={isActive ? 'currentColor' : 'none'} />
                  <span className={`text-[10px] font-medium ${isActive ? 'text-[#fc3c44]' : 'text-[#8e8e93]'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Full-screen Now Playing overlay ── */}
      <AnimatePresence>
        {showNowPlaying && (
          <LayoutGroup>
            <NowPlaying onNavigate={navigate} />
          </LayoutGroup>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Root export
// ─────────────────────────────────────────────────────────────

export function App() {
  return (
    <PlayerProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </PlayerProvider>
  );
}
