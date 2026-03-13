/**
 * api.ts
 * ─────────────────────────────────────────────────────────────
 * Typed API client for the Vault Music backend.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  BACKEND CONTRACT  (Fastify / Node.js)                  │
 * │                                                         │
 * │  GET  /api/artists               → ApiArtist[]          │
 * │  GET  /api/artists/:id           → ApiArtist            │
 * │  GET  /api/albums                → ApiAlbum[]           │
 * │  GET  /api/albums/:id            → ApiAlbum             │
 * │  GET  /api/tracks                → ApiPaginatedTracks   │
 * │       ?page=0&pageSize=50        (server-side paging)   │
 * │  GET  /api/tracks/:id            → ApiTrack             │
 * │  GET  /api/search?q=             → SearchResults        │
 * │  GET  /api/stream/:trackId       → 206 Partial Content  │
 * │       (supports Range header for iOS seek)              │
 * │  GET  /api/cover/:trackId        → image/jpeg|png       │
 * │                                                         │
 * │  POST /api/playlists             → Playlist             │
 * │  PATCH /api/playlists/:id        → Playlist             │
 * │  DELETE /api/playlists/:id       → { ok: true }         │
 * └─────────────────────────────────────────────────────────┘
 *
 * Range request strategy (streaming):
 *   The <audio> element sends:  Range: bytes=0-
 *   On seek to 50%:             Range: bytes=<offset>-
 *   Fastify responds with 206 and the correct Content-Range header.
 *   This is handled automatically because audioEl.src is set to the
 *   /api/stream/:id URL — the browser manages the Range headers itself.
 *   You do NOT need to manually set any headers on the frontend.
 *
 * Demo mode:
 *   When BASE_URL is empty ("") all methods return mock data from
 *   @/data/mockData so the app works without a running backend.
 */

import type {
  ApiAlbum,
  ApiArtist,
  ApiPaginatedTracks,
  ApiTrack,
  Track,
  Album,
  Artist,
  Playlist,
} from '@/types/music';

import {
  allTracks,
  allAlbums,
  allArtists,
  searchTracks,
  searchAlbums,
  searchArtists,
  getAlbumById,
  getArtistById,
} from '@/data/mockData';

// ─────────────────────────────────────────────────────────────
//  Configuration
//  Set VITE_API_URL in your .env file (e.g. http://192.168.1.5:3000)
//  when running against a real backend.  Leave blank for demo mode.
// ─────────────────────────────────────────────────────────────

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

const IS_DEMO = BASE_URL === '';

const LIKED_PLAYLIST_KEY = 'vault_liked_playlist_id';

// ─────────────────────────────────────────────────────────────
//  HTTP primitives
// ─────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch { /* ignore */ }
    throw new ApiError(res.status, `[${res.status}] ${detail}`);
  }

  // Some endpoints correctly return 204 No Content (e.g. DELETE).
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────
//  Mappers: ApiTrack → Track (frontend type)
// ─────────────────────────────────────────────────────────────

function mapTrack(t: ApiTrack): Track {
  return {
    ...t,
    // Resolve relative cover URL to absolute using the API base
    coverUrl: t.coverUrl.startsWith('http') ? t.coverUrl : `${BASE_URL}${t.coverUrl}`,
    audioUrl: t.audioUrl.startsWith('http') ? t.audioUrl : `${BASE_URL}${t.audioUrl}`,
    // Pass through quality metadata
    bitrate: t.bitrate,
    sampleRate: t.sampleRate,
    codec: t.codec,
    isLiked: t.isLiked,
  };
}

function mapAlbum(a: ApiAlbum): Album {
  return {
    id: a.id,
    title: a.title,
    artist: a.artist,
    artistId: a.artistId,
    year: a.year,
    genre: a.genre,
    coverUrl: a.coverUrl.startsWith('http') ? a.coverUrl : `${BASE_URL}${a.coverUrl}`,
    trackCount: a.trackCount,
    tracks: a.tracks.map(mapTrack),
  };
}

function mapArtist(a: ApiArtist): Artist {
  return {
    id: a.id,
    name: a.name,
    imageUrl: a.imageUrl.startsWith('http') ? a.imageUrl : `${BASE_URL}${a.imageUrl}`,
    albumCount: a.albumCount,
    trackCount: a.trackCount,
    albums: a.albums.map(mapAlbum),
  };
}

// ─────────────────────────────────────────────────────────────
//  API methods
// ─────────────────────────────────────────────────────────────

export const api = {
  // ── Artists ───────────────────────────────────────────────

  async getArtists(): Promise<Artist[]> {
    if (IS_DEMO) return allArtists;
    const data = await apiFetch<ApiArtist[]>('/api/artists');
    return data.map(mapArtist);
  },

  async getArtist(id: string): Promise<Artist | null> {
    if (IS_DEMO) return getArtistById(id) ?? null;
    try {
      const data = await apiFetch<ApiArtist>(`/api/artists/${id}`);
      return mapArtist(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  // ── Albums ────────────────────────────────────────────────

  async getAlbums(): Promise<Album[]> {
    if (IS_DEMO) return allAlbums;
    const data = await apiFetch<ApiAlbum[]>('/api/albums');
    return data.map(mapAlbum);
  },

  async getAlbum(id: string): Promise<Album | null> {
    if (IS_DEMO) return getAlbumById(id) ?? null;
    try {
      const data = await apiFetch<ApiAlbum>(`/api/albums/${id}`);
      return mapAlbum(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  // ── Tracks (paginated for large libraries) ────────────────

  async getTracks(page = 0, pageSize = 50): Promise<{ items: Track[]; total: number }> {
    if (IS_DEMO) {
      const start = page * pageSize;
      return {
        items: allTracks.slice(start, start + pageSize),
        total: allTracks.length,
      };
    }
    const data = await apiFetch<ApiPaginatedTracks>(
      `/api/tracks?page=${page}&pageSize=${pageSize}`,
    );
    return { items: data.items.map(mapTrack), total: data.total };
  },

  async getTrack(id: string): Promise<Track | null> {
    if (IS_DEMO) {
      return allTracks.find((t) => t.id === id) ?? null;
    }
    try {
      const data = await apiFetch<ApiTrack>(`/api/tracks/${id}`);
      return mapTrack(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  // ── Search ────────────────────────────────────────────────

  async search(query: string): Promise<{
    tracks: Track[];
    albums: Album[];
    artists: Artist[];
  }> {
    if (IS_DEMO) {
      return {
        tracks: searchTracks(query).slice(0, 12),
        albums: searchAlbums(query).slice(0, 6),
        artists: searchArtists(query).slice(0, 4),
      };
    }

    interface SearchResponse {
      tracks: ApiTrack[];
      albums: ApiAlbum[];
      artists: ApiArtist[];
    }

    const data = await apiFetch<SearchResponse>(
      `/api/search?q=${encodeURIComponent(query)}`,
    );
    return {
      tracks: data.tracks.map(mapTrack),
      albums: data.albums.map(mapAlbum),
      artists: data.artists.map(mapArtist),
    };
  },

  // ── Playlists ─────────────────────────────────────────────

  async getPlaylists(): Promise<Playlist[]> {
    if (IS_DEMO) {
      // Read from localStorage in demo mode
      try {
        const raw = localStorage.getItem('vault_playlists');
        return raw ? (JSON.parse(raw) as Playlist[]) : [];
      } catch {
        return [];
      }
    }
    return apiFetch<Playlist[]>('/api/playlists');
  },

  async getPlaylist(id: string): Promise<Playlist | null> {
    if (IS_DEMO) {
      const all = await api.getPlaylists();
      return all.find((p) => p.id === id) ?? null;
    }
    try {
      const data = await apiFetch<Playlist>(`/api/playlists/${id}`);
      return data;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async createPlaylist(name: string, description = ''): Promise<Playlist> {
    const pl: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      description,
      coverUrl: '',
      trackIds: [],
      createdAt: new Date().toISOString(),
    };

    if (IS_DEMO) {
      const existing = await api.getPlaylists();
      localStorage.setItem('vault_playlists', JSON.stringify([...existing, pl]));
      return pl;
    }

    return apiFetch<Playlist>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  async updatePlaylist(
    id: string,
    patch: Partial<Pick<Playlist, 'name' | 'description' | 'trackIds'>>,
  ): Promise<Playlist> {
    if (IS_DEMO) {
      const all = await api.getPlaylists();
      const updated = all.map((p) => (p.id === id ? { ...p, ...patch } : p));
      localStorage.setItem('vault_playlists', JSON.stringify(updated));
      return updated.find((p) => p.id === id)!;
    }

    return apiFetch<Playlist>(`/api/playlists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async deletePlaylist(id: string): Promise<void> {
    if (IS_DEMO) {
      const all = await api.getPlaylists();
      localStorage.setItem(
        'vault_playlists',
        JSON.stringify(all.filter((p) => p.id !== id)),
      );
      return;
    }
    await apiFetch(`/api/playlists/${id}`, { method: 'DELETE' });
  },

  // ── Streaming URL helper ──────────────────────────────────
  /**
   * Returns the URL the <audio> element should use.
   * The browser will automatically include Range headers for
   * seeking — the backend just needs to respond with 206.
   */
  streamUrl(trackId: string): string {
    return IS_DEMO ? '' : `${BASE_URL}/api/stream/${trackId}`;
  },

  // ── Lyrics ────────────────────────────────────────────────
  /**
   * Fetches raw LRC text for a track. Returns null if not found.
   */
  async getLyrics(trackId: string): Promise<string | null> {
    if (IS_DEMO) return null;
    try {
      const url = `${BASE_URL}/api/lyrics/${trackId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────
//  Helpers for "Liked Tracks" (backed by the isLiked column)
// ─────────────────────────────────────────────────────────────

export async function getLikedTrackIds(): Promise<string[]> {
  if (IS_DEMO) {
    // Demo mode: fall back to localStorage
    try {
      const raw = localStorage.getItem('vault_liked_ids');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
  return apiFetch<string[]>('/api/tracks/liked-ids');
}

export async function addLikedTrack(trackId: string): Promise<void> {
  if (IS_DEMO) {
    const ids = await getLikedTrackIds();
    if (!ids.includes(trackId)) {
      localStorage.setItem('vault_liked_ids', JSON.stringify([...ids, trackId]));
    }
    return;
  }
  await apiFetch(`/api/tracks/${encodeURIComponent(trackId)}/like`, {
    method: 'PATCH',
    body: JSON.stringify({ isLiked: true }),
  });
}

export async function removeLikedTrack(trackId: string): Promise<void> {
  if (IS_DEMO) {
    const ids = await getLikedTrackIds();
    localStorage.setItem('vault_liked_ids', JSON.stringify(ids.filter((id) => id !== trackId)));
    return;
  }
  await apiFetch(`/api/tracks/${encodeURIComponent(trackId)}/like`, {
    method: 'PATCH',
    body: JSON.stringify({ isLiked: false }),
  });
}

// ─────────────────────────────────────────────────────────────
//  Legacy "Liked Tracks" playlist helpers
//  Still used by Library / PlaylistDetail for the "Liked Tracks"
//  playlist view.
// ─────────────────────────────────────────────────────────────

export function getStoredLikedPlaylistId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LIKED_PLAYLIST_KEY);
  } catch {
    return null;
  }
}

export async function getOrCreateLikedPlaylist(): Promise<Playlist> {
  const storedId = getStoredLikedPlaylistId();
  const playlists = await api.getPlaylists();

  let liked =
    playlists.find((p) => p.id === storedId) ??
    playlists.find((p) => p.name.toLowerCase() === 'liked tracks');

  if (!liked) {
    liked = await api.createPlaylist('Liked Tracks', 'Songs you have liked');
  }

  if (!storedId || storedId !== liked.id) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LIKED_PLAYLIST_KEY, liked.id);
      } catch {
        // ignore
      }
    }
  }

  return liked;
}

// ─────────────────────────────────────────────────────────────
//  Playlist track mutation helpers
// ─────────────────────────────────────────────────────────────

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
  if (IS_DEMO) {
    const all = await api.getPlaylists();
    const updated = all.map((p) =>
      p.id === playlistId && !p.trackIds.includes(trackId)
        ? { ...p, trackIds: [...p.trackIds, trackId] }
        : p,
    );
    localStorage.setItem('vault_playlists', JSON.stringify(updated));
    return;
  }

  await apiFetch(`/api/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ trackIds: [trackId] }),
  });
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  if (IS_DEMO) {
    const all = await api.getPlaylists();
    const updated = all.map((p) =>
      p.id === playlistId
        ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
        : p,
    );
    localStorage.setItem('vault_playlists', JSON.stringify(updated));
    return;
  }

  await apiFetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
    method: 'DELETE',
  });
}
