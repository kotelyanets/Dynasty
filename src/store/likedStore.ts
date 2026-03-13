/**
 * likedStore.ts
 * ─────────────────────────────────────────────────────────────
 * Global state for liked track IDs, managed by Zustand.
 *
 * Every component that calls `useLikedTracks()` reads from the
 * same store, so toggling a like in NowPlaying is instantly
 * reflected in TrackRow, AlbumDetail, ArtistDetail, etc.
 */

import { create } from 'zustand';
import { getLikedTrackIds, addLikedTrack, removeLikedTrack } from '@/services/api';

// ── Types ────────────────────────────────────────────────────

interface LikedState {
  /** Set of liked track IDs for O(1) lookup */
  likedIds: Set<string>;
  /** True while the initial fetch is in flight */
  loading: boolean;
  /** Whether the initial fetch has completed at least once */
  _hydrated: boolean;
}

interface LikedActions {
  /** Fetch liked IDs from the backend (idempotent after first call) */
  hydrate: () => void;
  /** Optimistically toggle a track's liked status */
  toggleLike: (trackId: string) => void;
  /** Check if a track is liked */
  isLiked: (trackId: string) => boolean;
}

export type LikedStore = LikedState & LikedActions;

// ── Store ────────────────────────────────────────────────────

export const useLikedStore = create<LikedStore>()((set, get) => ({
  likedIds: new Set<string>(),
  loading: true,
  _hydrated: false,

  hydrate: () => {
    // Only fetch once — subsequent calls are no-ops.
    if (get()._hydrated) return;
    set({ _hydrated: true });

    getLikedTrackIds()
      .then((ids) => {
        set({ likedIds: new Set(ids), loading: false });
      })
      .catch(() => {
        set({ loading: false });
      });
  },

  toggleLike: (trackId: string) => {
    const prev = get().likedIds;
    const next = new Set(prev);

    if (next.has(trackId)) {
      next.delete(trackId);
      set({ likedIds: next });
      // Fire-and-forget sync with backend; we optimistically update UI.
      void removeLikedTrack(trackId);
    } else {
      next.add(trackId);
      set({ likedIds: next });
      // Fire-and-forget sync with backend; we optimistically update UI.
      void addLikedTrack(trackId);
    }
  },

  isLiked: (trackId: string) => get().likedIds.has(trackId),
}));
