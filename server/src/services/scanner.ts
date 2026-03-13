/**
 * scanner.ts
 * ─────────────────────────────────────────────────────────────
 * Library Scanner Service
 *
 * Responsibilities:
 *   1. Recursively walk a directory tree for audio files.
 *   2. Parse every file's ID3/Vorbis/MP4 tags with `music-metadata`.
 *   3. Extract embedded cover art, deduplicate by SHA-1 hash, write
 *      each unique image to `public/covers/<hash>.<ext>` exactly once.
 *   4. Upsert Artist → Album → Track into SQLite via Prisma.
 *   5. Return a structured result for CLI reporting.
 *
 * Design principles:
 *   • NEVER crash on a single bad file — errors are collected and
 *     reported at the end so a 10,000-track library isn't blocked
 *     by one corrupt MP3.
 *   • Idempotent: run it twice on the same directory, the DB won't
 *     have duplicates (upsert on unique keys).
 *   • Cover art deduplication: albums sharing art (e.g., a boxset)
 *     write the image file only once.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import * as mm from 'music-metadata';
import type { IAudioMetadata, IPicture } from 'music-metadata';
import db from '../db';
import config from '../config';

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

export interface ScanOptions {
  /** Root directory to scan (defaults to config.musicDir) */
  musicDir?: string;
  /** If true, re-parse files already in the DB (slower but refreshes metadata) */
  forceRescan?: boolean;
  /** Max concurrent file parses. Higher = faster but more memory. Default: 5 */
  concurrency?: number;
}

export interface ScanResult {
  musicDir:  string;
  total:     number;   // audio files discovered
  processed: number;   // successfully upserted
  skipped:   number;   // already in DB (when forceRescan=false)
  errors:    number;   // files that failed to parse/upsert
  errorLog:  Array<{ file: string; reason: string }>;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3', '.flac', '.m4a', '.aac',
  '.ogg', '.opus', '.wav', '.wma', '.alac',
]);

/** Maps file extension → MIME type for the streaming endpoint */
const MIME_BY_EXT: Record<string, string> = {
  '.mp3':  'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a':  'audio/mp4',
  '.aac':  'audio/aac',
  '.ogg':  'audio/ogg',
  '.opus': 'audio/opus',
  '.wav':  'audio/wav',
  '.wma':  'audio/x-ms-wma',
  '.alac': 'audio/mp4',
};

// ─────────────────────────────────────────────────────────────
//  Loudness (LUFS) measurement via FFmpeg
// ─────────────────────────────────────────────────────────────

let _ffmpegAvailable: boolean | null = null;

/**
 * Check once if FFmpeg is available on the system PATH.
 */
async function isFfmpegAvailable(): Promise<boolean> {
  if (_ffmpegAvailable !== null) return _ffmpegAvailable;
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], (err) => {
      _ffmpegAvailable = !err;
      if (!_ffmpegAvailable) {
        console.warn('[Scanner] FFmpeg not found — loudness normalization (LUFS) will be skipped.');
      }
      resolve(_ffmpegAvailable);
    });
  });
}

/**
 * Measure integrated loudness (LUFS) of an audio file using FFmpeg.
 * Returns null if FFmpeg is unavailable or measurement fails.
 *
 * Uses the EBU R128 `ebur128` audio filter which outputs a summary
 * line like:  I: -14.0 LUFS
 */
async function measureLoudness(filePath: string): Promise<number | null> {
  if (!(await isFfmpegAvailable())) return null;

  return new Promise((resolve) => {
    // -nostats suppresses progress; -f null discards output
    const args = [
      '-i', filePath,
      '-af', 'ebur128=peak=none',
      '-f', 'null', '-',
    ];

    execFile('ffmpeg', args, { timeout: 30000 }, (err, _stdout, stderr) => {
      if (err) {
        resolve(null);
        return;
      }
      // Parse "I: -14.0 LUFS" from the summary block in stderr
      const match = stderr.match(/I:\s+([-\d.]+)\s+LUFS/);
      if (match && match[1]) {
        const lufs = parseFloat(match[1]);
        resolve(isFinite(lufs) ? lufs : null);
      } else {
        resolve(null);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  File system helpers
// ─────────────────────────────────────────────────────────────

/**
 * Recursively collect every supported audio file under `dir`.
 * Uses Node 18's built-in `{ recursive: true }` option to avoid
 * a heavy third-party `glob` dependency.
 */
async function collectAudioFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (err) {
      // Permission denied or dangling symlink — skip silently
      console.warn(`[Scanner] Cannot read directory: ${current} — ${(err as Error).message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue; // Avoid infinite loops from symlinks
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Returns the set of file paths already stored in the DB,
 * used to skip files when `forceRescan` is false.
 */
async function getExistingPaths(): Promise<Set<string>> {
  const rows = await db.track.findMany({ select: { filePath: true } });
  return new Set(rows.map((r) => r.filePath));
}

// ─────────────────────────────────────────────────────────────
//  Cover art helpers
// ─────────────────────────────────────────────────────────────

/**
 * Ensures the covers output directory exists.
 * Called once at the start of a scan.
 */
async function ensureCoversDir(): Promise<void> {
  await fs.promises.mkdir(config.coversDir, { recursive: true });
}

/**
 * Extracts the best cover art picture from a track's metadata,
 * writes it to disk (deduped by SHA-1 hash of the raw data),
 * and returns the public URL path (`/covers/<hash>.<ext>`).
 *
 * Returns `null` if no embedded art is found.
 *
 * Deduplication strategy:
 *   SHA-1 of the raw image bytes → hex string → filename.
 *   Albums sharing the same image (common in boxsets) write one file.
 *   Cost: ~0.1 ms per image to hash; negligible for a library scan.
 */
async function extractCoverArt(pictures: IPicture[] | undefined): Promise<string | null> {
  if (!pictures || pictures.length === 0) return null;

  // Prefer "Cover (front)" type (ID3 APIC type 3), fall back to first image
  const cover =
    pictures.find((p) => p.type === 'Cover (front)') ??
    pictures.find((p) => p.type === undefined) ??
    pictures[0];

  if (!cover?.data || cover.data.length === 0) return null;

  // Determine extension from MIME type
  const fmt = cover.format?.toLowerCase() ?? 'image/jpeg';
  let ext = '.jpg';
  if (fmt.includes('png'))  ext = '.png';
  if (fmt.includes('webp')) ext = '.webp';
  if (fmt.includes('gif'))  ext = '.gif';

  // Hash the raw bytes — identical art files get the same filename
  const hash = crypto
    .createHash('sha1')
    .update(cover.data)
    .digest('hex');

  const filename = `${hash}${ext}`;
  const destPath = path.join(config.coversDir, filename);

  // Only write if it doesn't exist yet (idempotent)
  try {
    await fs.promises.access(destPath, fs.constants.F_OK);
    // File exists → nothing to do
  } catch {
    // File doesn't exist → write it
    await fs.promises.writeFile(destPath, cover.data);
  }

  return `/covers/${filename}`;
}

// ─────────────────────────────────────────────────────────────
//  Metadata helpers
// ─────────────────────────────────────────────────────────────

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/**
 * Derive a clean track title.
 * Fallback chain: ID3 title → filename without extension
 */
function resolveTitle(rawTitle: string | undefined, filePath: string): string {
  if (rawTitle?.trim()) return rawTitle.trim();
  // "04 - Some Song.mp3" → "Some Song" (strip leading track number)
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/^\d+[\s._-]+/, '').trim() || base;
}

function resolveArtistName(meta: IAudioMetadata): string {
  return (
    meta.common.artist?.trim() ||
    meta.common.albumartist?.trim() ||
    meta.common.artists?.[0]?.trim() ||
    'Unknown Artist'
  );
}

/**
 * Resolve the artist name used for **album grouping**.
 * Prefers `albumartist` over `artist` because `albumartist` is
 * consistent across all tracks of an album, while `artist` may
 * vary per track (e.g. "Artist feat. Someone").  Using `artist`
 * for album grouping caused the same album to be split into many
 * duplicate records — one per unique track-level artist string.
 */
function resolveAlbumArtistName(meta: IAudioMetadata): string {
  return (
    meta.common.albumartist?.trim() ||
    meta.common.artist?.trim() ||
    meta.common.artists?.[0]?.trim() ||
    'Unknown Artist'
  );
}

function resolveAlbumTitle(meta: IAudioMetadata): string {
  return meta.common.album?.trim() || 'Unknown Album';
}

// ─────────────────────────────────────────────────────────────
//  Core upsert logic
// ─────────────────────────────────────────────────────────────

/**
 * Process a single audio file:
 *   parse → extract art → upsert Artist/Album/Track
 */
async function processFile(filePath: string): Promise<void> {
  // ── Parse metadata ────────────────────────────────────────
  // `skipCovers: false` is important — we want the embedded art.
  // `duration: true` forces a full file read for accurate duration
  // on VBR MP3s (slower but correct).
  let meta: IAudioMetadata;
  try {
    meta = await mm.parseFile(filePath, {
      skipCovers: false,
      duration: true,
    });
  } catch (err) {
    throw new Error(`music-metadata parse failed: ${(err as Error).message}`);
  }

  const { common, format } = meta;

  // ── Extract cover art ─────────────────────────────────────
  const coverPath = await extractCoverArt(common.picture);

  // ── File stats ────────────────────────────────────────────
  const stat = await fs.promises.stat(filePath);
  const mimeType = getMimeType(filePath);

  // ── Measure loudness (LUFS) via FFmpeg ────────────────────
  const loudnessLufs = await measureLoudness(filePath);

  // ── Resolve denormalized strings ──────────────────────────
  const artistName = resolveArtistName(meta);
  const albumArtistName = resolveAlbumArtistName(meta);
  const albumTitle = resolveAlbumTitle(meta);
  const trackTitle = resolveTitle(common.title, filePath);

  // ── Upsert Album Artist ───────────────────────────────────
  // Use `albumartist` (when available) for album grouping so
  // that all tracks of the same album share a single Album row,
  // even when individual tracks have different `artist` tags
  // (e.g. featuring credits).
  const albumArtist = await db.artist.upsert({
    where:  { name: albumArtistName },
    update: {
      // Update imageUrl if we found cover art and it wasn't set before
      ...(coverPath && { imageUrl: coverPath }),
    },
    create: {
      name:     albumArtistName,
      imageUrl: coverPath ?? null,
    },
  });

  // ── Upsert Track Artist (may differ from album artist) ────
  const trackArtist = albumArtistName === artistName
    ? albumArtist
    : await db.artist.upsert({
        where:  { name: artistName },
        update: {
          ...(coverPath && { imageUrl: coverPath }),
        },
        create: {
          name:     artistName,
          imageUrl: coverPath ?? null,
        },
      });

  // ── Upsert Album ──────────────────────────────────────────
  const album = await db.album.upsert({
    where: {
      title_artistId: { title: albumTitle, artistId: albumArtist.id },
    },
    update: {
      year:        common.year        ?? undefined,
      genre:       common.genre?.[0]  ?? undefined,
      totalTracks: common.track?.of   ?? undefined,
      // Prefer to keep existing cover art; only update if we now have one
      ...(coverPath && { coverPath }),
    },
    create: {
      title:       albumTitle,
      artistId:    albumArtist.id,
      year:        common.year        ?? null,
      genre:       common.genre?.[0]  ?? null,
      coverPath:   coverPath          ?? null,
      totalTracks: common.track?.of   ?? null,
    },
  });

  // ── Upsert Track ──────────────────────────────────────────
  // `filePath` is the unique key — re-scanning the same file
  // updates its metadata rather than creating a duplicate.
  await db.track.upsert({
    where:  { filePath },
    update: {
      title:       trackTitle,
      artistId:    trackArtist.id,
      albumId:     album.id,
      duration:    format.duration    ?? null,
      trackNumber: common.track?.no   ?? null,
      diskNumber:  common.disk?.no    ?? null,
      genre:       common.genre?.[0]  ?? null,
      bitrate:     format.bitrate ? Math.round(format.bitrate / 1000) : null,
      sampleRate:  format.sampleRate  ?? null,
      codec:       format.codec       ?? null,
      fileSize:    stat.size,
      mimeType,
      loudnessLufs,
    },
    create: {
      title:       trackTitle,
      artistId:    trackArtist.id,
      albumId:     album.id,
      filePath,
      duration:    format.duration    ?? null,
      trackNumber: common.track?.no   ?? null,
      diskNumber:  common.disk?.no    ?? null,
      genre:       common.genre?.[0]  ?? null,
      bitrate:     format.bitrate ? Math.round(format.bitrate / 1000) : null,
      sampleRate:  format.sampleRate  ?? null,
      codec:       format.codec       ?? null,
      fileSize:    stat.size,
      mimeType,
      loudnessLufs,
    },
  });
}

// ─────────────────────────────────────────────────────────────
//  Concurrency limiter
//  Simple pool — avoids loading an entire library into memory
//  while still processing multiple files in parallel.
// ─────────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onComplete?: (done: number, total: number) => void,
): Promise<{ results: Array<T | Error> }> {
  const results: Array<T | Error> = new Array(tasks.length);
  let nextIndex = 0;
  let doneCount = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      const task = tasks[i];
      if (!task) continue;
      try {
        results[i] = await task();
      } catch (err) {
        results[i] = err instanceof Error ? err : new Error(String(err));
      } finally {
        doneCount++;
        onComplete?.(doneCount, tasks.length);
      }
    }
  }

  // Spawn `concurrency` workers
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { results };
}

// ─────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────

/**
 * Main entry point.
 * Scans `opts.musicDir` (or `config.musicDir`), parses every audio
 * file, and upserts the results into the database.
 *
 * @example
 *   const result = await scanLibrary({ musicDir: '/Volumes/Music' });
 *   console.log(`Processed ${result.processed}/${result.total} tracks`);
 */
export async function scanLibrary(opts: ScanOptions = {}): Promise<ScanResult> {
  const startTime  = Date.now();
  const musicDir   = opts.musicDir   ?? config.musicDir;
  const concurrency = opts.concurrency ?? 5;
  const forceRescan = opts.forceRescan ?? false;

  console.log(`\n🎵 Vault Scanner — starting`);
  console.log(`   Directory  : ${musicDir}`);
  console.log(`   Force rescan: ${forceRescan}`);
  console.log(`   Concurrency: ${concurrency}\n`);

  // ── Pre-flight checks ────────────────────────────────────
  try {
    await fs.promises.access(musicDir, fs.constants.R_OK);
  } catch {
    throw new Error(`Music directory is not readable: ${musicDir}`);
  }

  await ensureCoversDir();

  // ── Collect files ────────────────────────────────────────
  console.log('📂 Collecting audio files...');
  const allFiles = await collectAudioFiles(musicDir);
  console.log(`   Found ${allFiles.length} audio file(s)\n`);

  if (allFiles.length === 0) {
    return {
      musicDir, total: 0, processed: 0,
      skipped: 0, errors: 0, errorLog: [],
      durationMs: Date.now() - startTime,
    };
  }

  // ── Determine which files to process ─────────────────────
  let filesToProcess = allFiles;
  let skippedCount   = 0;

  if (!forceRescan) {
    const existing = await getExistingPaths();
    filesToProcess  = allFiles.filter((f) => !existing.has(f));
    skippedCount    = allFiles.length - filesToProcess.length;
    if (skippedCount > 0) {
      console.log(`   Skipping ${skippedCount} already-indexed file(s)`);
    }
  }

  console.log(`⚙️  Processing ${filesToProcess.length} file(s) at concurrency=${concurrency}...\n`);

  // ── Process files with concurrency limit ─────────────────
  const errorLog: Array<{ file: string; reason: string }> = [];
  let lastLoggedPercent = -1;

  const tasks = filesToProcess.map(
    (filePath) => async () => processFile(filePath)
  );

  const { results } = await runWithConcurrency(tasks, concurrency, (done, total) => {
    const pct = Math.floor((done / total) * 100);
    if (pct % 10 === 0 && pct !== lastLoggedPercent) {
      lastLoggedPercent = pct;
      process.stdout.write(`   ${pct}% (${done}/${total})\r`);
    }
  });

  // ── Tally results ────────────────────────────────────────
  let processedCount = 0;
  results.forEach((result, i) => {
    if (result instanceof Error) {
      const filePath = filesToProcess[i] ?? 'unknown';
      errorLog.push({ file: filePath, reason: result.message });
    } else {
      processedCount++;
    }
  });

  const durationMs = Date.now() - startTime;

  // ── Final report ─────────────────────────────────────────
  console.log(`\n\n✅ Scan complete in ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`   Total files  : ${allFiles.length}`);
  console.log(`   Processed    : ${processedCount}`);
  console.log(`   Skipped      : ${skippedCount}`);
  console.log(`   Errors       : ${errorLog.length}`);

  if (errorLog.length > 0) {
    console.log('\n⚠️  Files with errors:');
    errorLog.forEach(({ file, reason }) =>
      console.log(`   ${path.basename(file)}: ${reason}`)
    );
  }

  return {
    musicDir,
    total:      allFiles.length,
    processed:  processedCount,
    skipped:    skippedCount,
    errors:     errorLog.length,
    errorLog,
    durationMs,
  };
}
