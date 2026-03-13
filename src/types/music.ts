// ─────────────────────────────────────────────────────────────
//  Core domain models
// ─────────────────────────────────────────────────────────────

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number; // seconds
  trackNumber: number;
  genre: string;
  year: number;
  coverUrl: string;
  /**
   * URL that the <audio> element will load.
   * In production this points to your Fastify streaming endpoint:
   *   GET /api/stream/:trackId   (supports Range / 206 Partial Content)
   * Leave undefined to stay in "demo mode" (progress simulated).
   */
  audioUrl?: string;

  // ── Technical audio metadata (for quality badges) ──────────
  /** Bitrate in kbps (e.g. 320 for MP3, 1411 for CD FLAC) */
  bitrate?: number;
  /** Sample rate in Hz (e.g. 44100, 96000) */
  sampleRate?: number;
  /** Codec name (e.g. "FLAC", "MPEG 1 Layer 3") */
  codec?: string;
  /** Whether the user has "hearted" this track */
  isLiked?: boolean;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  year: number;
  genre: string;
  coverUrl: string;
  trackCount: number;
  tracks: Track[];
}

export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  albumCount: number;
  trackCount: number;
  albums: Album[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
//  Playback engine types
// ─────────────────────────────────────────────────────────────

export type RepeatMode = 'off' | 'all' | 'one';

/**
 * Granular buffering / loading state so the UI can show
 * a spinner during network stalls without a boolean flag.
 *
 *  idle      – no track loaded
 *  loading   – src just changed, waiting for canplay
 *  buffering – mid-stream stall (readyState < HAVE_FUTURE_DATA)
 *  ready     – can play
 *  error     – unrecoverable load error
 */
export type BufferingState = 'idle' | 'loading' | 'buffering' | 'ready' | 'error';

// ─────────────────────────────────────────────────────────────
//  Zustand store shape (exported so hooks can type-annotate)
// ─────────────────────────────────────────────────────────────

export interface PlayerStoreState {
  // ── track / queue ──────────────────────────────────────────
  currentTrack: Track | null;
  queue: Track[];
  /** Index into `queue` of the currently playing track */
  queueIndex: number;
  /**
   * When shuffle is ON we maintain a visited-history stack so
   * "previous" works correctly instead of picking a new random track.
   */
  shuffleHistory: number[];
  /** Recently played tracks (most recent first) */
  playHistory: Track[];

  // ── playback state ─────────────────────────────────────────
  isPlaying: boolean;
  currentTime: number;   // seconds, synced from HTMLAudioElement.timeupdate
  duration: number;      // seconds, synced from HTMLAudioElement.durationchange
  buffered: number;      // 0-1 fraction of the audio that has been buffered
  bufferingState: BufferingState;
  volume: number;        // 0-1
  isMuted: boolean;

  // ── modes ───────────────────────────────────────────────────
  shuffle: boolean;
  repeat: RepeatMode;

  // ── crossfade & autoplay ────────────────────────────────────
  crossfadeEnabled: boolean;
  /** Crossfade overlap duration in seconds (default 5). */
  crossfadeDuration: number;
  /** When true, auto-fetch similar tracks when the queue runs out. */
  autoplayInfinity: boolean;
  /** Internal flag — true while a crossfade transition is in progress. */
  _isCrossfading: boolean;
  /** Internal flag — true when infinity mode needs more tracks. */
  _awaitingAutoplay: boolean;

  // ── UI state ────────────────────────────────────────────────
  showNowPlaying: boolean;
  errorMessage: string | null;

  // ── audio effects ──────────────────────────────────────────
  karaokeEnabled: boolean;
  spatialAudioEnabled: boolean;
}

export interface PlayerStoreActions {
  // ── queue management ───────────────────────────────────────
  playTrack: (track: Track, queue?: Track[], index?: number, options?: { skipAudioLoad?: boolean }) => void;
  playQueueIndex: (index: number) => void;
  addToQueue: (tracks: Track[]) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;

  // ── transport ──────────────────────────────────────────────
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;

  // ── audio properties ───────────────────────────────────────
  setVolume: (v: number) => void;
  toggleMute: () => void;

  // ── modes ───────────────────────────────────────────────────
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleCrossfade: () => void;
  setCrossfadeDuration: (seconds: number) => void;
  toggleAutoplayInfinity: () => void;

  // ── audio effects ──────────────────────────────────────────
  toggleKaraoke: () => void;
  toggleSpatialAudio: () => void;

  // ── UI ─────────────────────────────────────────────────────
  setShowNowPlaying: (show: boolean) => void;

  // ── internal (called by useAudioEngine event listeners) ────
  _setCurrentTime: (t: number) => void;
  _setDuration: (d: number) => void;
  _setBuffered: (b: number) => void;
  _setBufferingState: (s: BufferingState) => void;
  _setIsPlaying: (v: boolean) => void;
  _setError: (msg: string | null) => void;
  _setIsCrossfading: (v: boolean) => void;
  _setAwaitingAutoplay: (v: boolean) => void;
}

export type PlayerStore = PlayerStoreState & PlayerStoreActions;

// ─────────────────────────────────────────────────────────────
//  Navigation
// ─────────────────────────────────────────────────────────────

export type ViewMode =
  | 'home'
  | 'search'
  | 'library'
  | 'artist'
  | 'album'
  | 'playlist'
  | 'nowplaying';

export interface NavigationState {
  view: ViewMode;
  id?: string;
}

// ─────────────────────────────────────────────────────────────
//  API response shapes  (matches the Fastify backend contract)
// ─────────────────────────────────────────────────────────────

export interface ApiTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number;
  trackNumber: number;
  genre: string;
  year: number;
  coverUrl: string;   // e.g. /api/cover/:trackId
  audioUrl: string;   // e.g. /api/stream/:trackId
  bitrate?: number;   // kbps
  sampleRate?: number; // Hz
  codec?: string;     // e.g. "FLAC", "MPEG 1 Layer 3"
  isLiked?: boolean;  // true when the user has "hearted" this track
}

export interface ApiAlbum {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  year: number;
  genre: string;
  coverUrl: string;
  trackCount: number;
  tracks: ApiTrack[];
}

export interface ApiArtist {
  id: string;
  name: string;
  imageUrl: string;
  albumCount: number;
  trackCount: number;
  albums: ApiAlbum[];
}

export interface ApiPaginatedTracks {
  items: ApiTrack[];
  total: number;
  page: number;
  pageSize: number;
}
