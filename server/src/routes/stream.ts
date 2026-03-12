/**
 * routes/stream.ts
 * ─────────────────────────────────────────────────────────────
 * Bulletproof HTTP 206 Partial Content audio streaming for iOS Safari.
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  WHY SAFARI BREAKS WITH NAIVE STREAMING                   ║
 * ║                                                           ║
 * ║  1. Safari / AVFoundation ALWAYS sends a Range probe      ║
 * ║     before loading any audio. If the server responds      ║
 * ║     with 200 (even with correct content), Safari will     ║
 * ║     silently refuse to play FLACs, M4As, and long MP3s.  ║
 * ║                                                           ║
 * ║  2. The probe sequence Safari uses:                       ║
 * ║     a) HEAD /api/stream/:id  → checks Content-Type        ║
 * ║     b) GET  Range: bytes=0-1 → 2-byte sanity probe        ║
 * ║     c) GET  Range: bytes=0-  → starts playback            ║
 * ║     d) GET  Range: bytes=N-  → on each seek               ║
 * ║                                                           ║
 * ║  3. FLAC requires audio/flac (not audio/x-flac).          ║
 * ║     Safari 15+ accepts audio/flac natively.               ║
 * ║                                                           ║
 * ║  RULE: This server ALWAYS responds 206, even when no      ║
 * ║  Range header is sent (treat it as bytes=0-).             ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * RFC 7233 range clamping rules:
 *   • `end` > fileSize-1  → clamp to fileSize-1  (NOT a 416 error)
 *   • `start` >= fileSize → 416 Range Not Satisfiable
 *   • `end`   < `start`  → 416 Range Not Satisfiable
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import db from '../db';

// ─────────────────────────────────────────────────────────────
//  MIME type map
//  'audio/flac' is the RFC 5334 registered type — Safari 15+ plays it.
// ─────────────────────────────────────────────────────────────

const AUDIO_MIME: Readonly<Record<string, string>> = {
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

function getMime(filePath: string): string {
  return AUDIO_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

// ─────────────────────────────────────────────────────────────
//  ETag helper — cheap, stable, based on inode + mtime + size
// ─────────────────────────────────────────────────────────────

function makeETag(stat: fs.Stats): string {
  const raw = `${stat.ino}-${stat.mtimeMs}-${stat.size}`;
  return `"${crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16)}"`;
}

// ─────────────────────────────────────────────────────────────
//  Range parser  (RFC 7233 §2.1)
// ─────────────────────────────────────────────────────────────

interface ParsedRange {
  start: number;
  end:   number;
}

/**
 * Parse "bytes=<start>-<end>" into {start, end}.
 * `end` is INCLUSIVE and may exceed fileSize-1 — the caller must clamp it.
 * Returns null only for syntactically invalid headers.
 */
function parseRangeHeader(header: string, fileSize: number): ParsedRange | null {
  const match = header.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  let start: number;
  let end:   number;

  if (rawStart === '' && rawEnd !== '') {
    // Suffix: bytes=-N  →  last N bytes
    const suffix = parseInt(rawEnd!, 10);
    if (!suffix || suffix <= 0) return null;
    start = Math.max(0, fileSize - suffix);
    end   = fileSize - 1;
  } else if (rawEnd === '') {
    // Open: bytes=N-  →  from N to EOF
    start = parseInt(rawStart!, 10);
    end   = fileSize - 1;
  } else {
    // Explicit: bytes=N-M
    start = parseInt(rawStart!, 10);
    end   = parseInt(rawEnd!,   10);
  }

  if (isNaN(start) || isNaN(end)) return null;

  // RFC 7233: clamp end to fileSize-1 (NOT an error if end > fileSize-1)
  end = Math.min(end, fileSize - 1);

  return { start, end };
}

// ─────────────────────────────────────────────────────────────
//  Common response headers (set on every streaming response)
// ─────────────────────────────────────────────────────────────

function setCommonHeaders(
  reply:    FastifyReply,
  mimeType: string,
  fileSize: number,
  stat:     fs.Stats,
): void {
  const etag         = makeETag(stat);
  const lastModified = stat.mtime.toUTCString();

  reply
    .header('Accept-Ranges',  'bytes')
    .header('Content-Type',   mimeType)
    .header('ETag',            etag)
    .header('Last-Modified',   lastModified)
    // 'no-store' prevents Safari from trying to load from a stale cache
    // after the server restarts while the URL stays the same.
    .header('Cache-Control',  'no-store')
    .header('Cross-Origin-Resource-Policy', 'cross-origin')
    .header(
      'Access-Control-Expose-Headers',
      'Content-Range, Content-Length, Accept-Ranges, Content-Type, ETag',
    );

  // Unused but helps some clients know the full file size
  void fileSize;
}

// ─────────────────────────────────────────────────────────────
//  Route plugin
// ─────────────────────────────────────────────────────────────

interface StreamParams {
  trackId: string;
}

const streamRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── HEAD /api/stream/:trackId ─────────────────────────────
  // Safari calls HEAD to verify Content-Type and Accept-Ranges
  // before committing to a GET.  Must be fast — no DB writes.
  fastify.head<{ Params: StreamParams }>(
    '/api/stream/:trackId',
    async (
      request: FastifyRequest<{ Params: StreamParams }>,
      reply:   FastifyReply,
    ) => {
      const track = await db.track.findUnique({
        where:  { id: request.params.trackId },
        select: { filePath: true, mimeType: true, fileSize: true },
      });
      if (!track) return reply.status(404).send();

      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(track.filePath);
      } catch {
        return reply.status(404).send();
      }

      const mimeType = track.mimeType ?? getMime(track.filePath);
      const fileSize = stat.size;

      return reply
        .header('Accept-Ranges',   'bytes')
        .header('Content-Type',    mimeType)
        .header('Content-Length',  fileSize)
        .header('ETag',            makeETag(stat))
        .header('Last-Modified',   stat.mtime.toUTCString())
        .header('Cache-Control',   'no-store')
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .status(200)
        .send();
    },
  );

  // ── GET /api/stream/:trackId ──────────────────────────────
  fastify.get<{ Params: StreamParams }>(
    '/api/stream/:trackId',
    async (
      request: FastifyRequest<{ Params: StreamParams }>,
      reply:   FastifyReply,
    ) => {
      const { trackId } = request.params;

      // ── 1. Resolve track ─────────────────────────────────
      const track = await db.track.findUnique({
        where:  { id: trackId },
        select: { id: true, filePath: true, mimeType: true, fileSize: true },
      });

      if (!track) {
        return reply.status(404).send({ error: 'Track not found', trackId });
      }

      // ── 2. Stat the file ──────────────────────────────────
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(track.filePath);
      } catch {
        fastify.log.error({ trackId, filePath: track.filePath }, 'File not on disk');
        return reply.status(404).send({ error: 'Audio file not found on disk' });
      }

      const fileSize = stat.size;
      const mimeType = track.mimeType ?? getMime(track.filePath);

      // Edge case: empty file
      if (fileSize === 0) {
        return reply.status(204).send();
      }

      // ── 3. Conditional GET (ETag / If-None-Match) ─────────
      const etag = makeETag(stat);
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        return reply.status(304).send();
      }

      // ── 4. Set universal headers ──────────────────────────
      setCommonHeaders(reply, mimeType, fileSize, stat);

      // ── 5. Increment play count (fire-and-forget) ─────────
      db.track
        .update({
          where: { id: trackId },
          data:  { playCount: { increment: 1 }, lastPlayed: new Date() },
        })
        .catch((e: Error) =>
          fastify.log.warn(`playCount update failed for ${trackId}: ${e.message}`),
        );

      // ── 6. Determine byte range ───────────────────────────
      //
      // CRITICAL SAFARI RULE:
      //   We ALWAYS respond 206, even when no Range header is present.
      //   Treat a missing Range header as "bytes=0-" (full file from start).
      //   A 200 response for FLAC causes AVFoundation to refuse playback.
      //
      const rangeHeader = request.headers['range'] ?? 'bytes=0-';
      const range        = parseRangeHeader(rangeHeader, fileSize);

      if (!range) {
        // Syntactically invalid Range header
        reply.header('Content-Range', `bytes */${fileSize}`);
        return reply.status(416).send({ error: 'Invalid Range header', received: rangeHeader });
      }

      const { start, end } = range;

      // start must be within the file (end was already clamped by parser)
      if (start >= fileSize || start > end) {
        fastify.log.warn({ trackId, start, end, fileSize }, '416 Range Not Satisfiable');
        reply.header('Content-Range', `bytes */${fileSize}`);
        return reply.status(416).send({ error: 'Range Not Satisfiable' });
      }

      const chunkSize = end - start + 1;

      fastify.log.debug(
        { trackId, mimeType, start, end, chunkSize, fileSize },
        '← 206',
      );

      // ── 7. Set 206 headers ────────────────────────────────
      reply
        .header('Content-Range',  `bytes ${start}-${end}/${fileSize}`)
        .header('Content-Length', chunkSize);

      // ── 8. Stream the slice ───────────────────────────────
      // fs.createReadStream {start, end} are INCLUSIVE — exact match to
      // HTTP byte ranges. The OS reads exactly `chunkSize` bytes.
      const fileStream = fs.createReadStream(track.filePath, { start, end });

      fileStream.on('error', (err: NodeJS.ErrnoException) => {
        fastify.log.error({ trackId, start, end, code: err.code }, 'ReadStream error');
        if (!reply.sent) {
          void reply.status(500).send({ error: 'Stream read error' });
        }
      });

      return reply.status(206).send(fileStream);
    },
  );

  done();
};

export default streamRoutes;
