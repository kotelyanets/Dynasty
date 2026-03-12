/**
 * watcher.ts
 * ─────────────────────────────────────────────────────────────
 * File-system watcher for the music directory.
 *
 * Uses chokidar to monitor `MUSIC_DIR` for new, changed, or
 * removed audio files and automatically updates the database —
 * eliminating the need to run `npm run scan` manually every
 * time a track is added.
 *
 * Design:
 *   • Watches only supported audio extensions (same set as scanner).
 *   • Debounces add/change events: files that are still being
 *     copied (partial writes) are processed only after the file
 *     system goes quiet for DEBOUNCE_MS.
 *   • Deletions remove the Track row from the DB immediately, then
 *     clean up any orphaned Album/Artist rows left behind.
 *   • The watcher ignores the initial directory scan performed by
 *     chokidar — only reacts to events *after* the ready event.
 */

import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import config from '../config';
import db from '../db';
import { processFile, SUPPORTED_EXTENSIONS, ensureCoversDir } from './scanner';

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────

/** Wait this long after the last FS event before processing the batch. */
const DEBOUNCE_MS = 2_000;

// ─────────────────────────────────────────────────────────────
//  Module state
// ─────────────────────────────────────────────────────────────

let watcher: FSWatcher | null = null;

/** Files waiting to be processed (add or change). */
let pendingFiles = new Set<string>();

/** Debounce timer handle. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function isSupportedAudio(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Process all files that have accumulated in the pending set.
 * Runs with a small concurrency to avoid overwhelming the DB.
 */
async function flushPending(): Promise<void> {
  if (pendingFiles.size === 0) return;

  const files = [...pendingFiles];
  pendingFiles.clear();

  console.log(`[Watcher] Processing ${files.length} new/changed file(s)...`);

  await ensureCoversDir();

  let ok = 0;
  let fail = 0;

  for (const filePath of files) {
    try {
      await processFile(filePath);
      ok++;
      console.log(`[Watcher]  ✓ ${path.basename(filePath)}`);
    } catch (err) {
      fail++;
      console.error(
        `[Watcher]  ✗ ${path.basename(filePath)}: ${(err as Error).message}`,
      );
    }
  }

  console.log(
    `[Watcher] Batch done — ${ok} processed, ${fail} error(s)`,
  );
}

/**
 * Schedule a debounced flush.
 * If another event arrives within DEBOUNCE_MS the timer resets,
 * so a large batch of files being copied is processed in one go.
 */
function scheduleBatch(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushPending().catch((err) =>
      console.error('[Watcher] Flush error:', err),
    );
  }, DEBOUNCE_MS);
}

/**
 * Remove a track from the database and clean up any orphaned
 * Album or Artist rows that no longer have associated tracks.
 */
async function handleDelete(filePath: string): Promise<void> {
  try {
    const track = await db.track.findUnique({
      where: { filePath },
      select: { id: true, albumId: true, artistId: true },
    });

    if (!track) return; // File wasn't indexed — nothing to do

    // Delete the track
    await db.track.delete({ where: { id: track.id } });
    console.log(`[Watcher]  🗑 Removed: ${path.basename(filePath)}`);

    // Clean up orphaned album (no more tracks)
    if (track.albumId) {
      const albumTrackCount = await db.track.count({
        where: { albumId: track.albumId },
      });
      if (albumTrackCount === 0) {
        await db.album.delete({ where: { id: track.albumId } });
        console.log(`[Watcher]  🗑 Removed orphaned album`);
      }
    }

    // Clean up orphaned artist (no more tracks AND no more albums)
    if (track.artistId) {
      const artistTrackCount = await db.track.count({
        where: { artistId: track.artistId },
      });
      const artistAlbumCount = await db.album.count({
        where: { artistId: track.artistId },
      });
      if (artistTrackCount === 0 && artistAlbumCount === 0) {
        await db.artist.delete({ where: { id: track.artistId } });
        console.log(`[Watcher]  🗑 Removed orphaned artist`);
      }
    }
  } catch (err) {
    console.error(
      `[Watcher] Delete handling failed for ${path.basename(filePath)}: ${(err as Error).message}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────

/**
 * Start watching `config.musicDir` for file-system changes.
 * Resolves once chokidar has finished its initial scan and is
 * actively watching.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function startWatcher(): Promise<void> {
  if (watcher) return; // Already running

  const musicDir = config.musicDir;

  return new Promise<void>((resolve, reject) => {
    watcher = chokidar.watch(musicDir, {
      // Don't fire add events for files that already exist when
      // the watcher starts — the user runs `npm run scan` for
      // the initial import, or those files are already indexed.
      ignoreInitial: true,

      // Ignore dot-files and common non-audio junk
      ignored: [
        /(^|[/\\])\./,             // dot-files / dot-folders
        /thumbs\.db$/i,
        /desktop\.ini$/i,
        /\.DS_Store$/i,
      ],

      // Wait for file writes to finish (helps with large copies)
      awaitWriteFinish: {
        stabilityThreshold: 1_000,
        pollInterval: 200,
      },

      // Recurse into sub-directories
      depth: undefined, // unlimited
      persistent: true,
    });

    watcher
      .on('add', (filePath: string) => {
        if (!isSupportedAudio(filePath)) return;
        pendingFiles.add(filePath);
        scheduleBatch();
      })
      .on('change', (filePath: string) => {
        if (!isSupportedAudio(filePath)) return;
        pendingFiles.add(filePath);
        scheduleBatch();
      })
      .on('unlink', (filePath: string) => {
        if (!isSupportedAudio(filePath)) return;
        // Remove from pending in case it was queued but deleted before processing
        pendingFiles.delete(filePath);
        handleDelete(filePath);
      })
      .on('ready', () => {
        console.log(`[Watcher] 👀 Watching for changes: ${musicDir}`);
        resolve();
      })
      .on('error', (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Watcher] Error: ${message}`);
        // Don't reject after ready — log and keep watching
        if (!watcher) reject(err);
      });
  });
}

/**
 * Stop watching and clean up resources.
 * Safe to call even if the watcher was never started.
 */
export async function stopWatcher(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Process any remaining pending files before shutting down
  if (pendingFiles.size > 0) {
    console.log('[Watcher] Flushing pending files before shutdown...');
    await flushPending();
  }

  if (watcher) {
    await watcher.close();
    watcher = null;
    console.log('[Watcher] Stopped.');
  }
}
