/**
 * routes/playHistory.ts — Play History & Music Replay Stats
 * ─────────────────────────────────────────────────────────────
 * Records listening sessions and generates "Replay" style stats.
 *
 * POST /api/play-history                — Record a listen (>30s)
 * GET  /api/play-history/stats          — Get monthly/yearly stats
 * GET  /api/play-history/stats/top-tracks — Top tracks by plays
 * GET  /api/play-history/stats/top-artists — Top artists by plays
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import db from '../db';
import { z } from 'zod';

const recordPlaySchema = z.object({
  trackId: z.string().min(1),
  duration: z.number().min(30, 'Must listen for at least 30 seconds'),
});

const playHistoryRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── POST /api/play-history ────────────────────────────────
  fastify.post(
    '/play-history',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = recordPlaySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
      }

      const { trackId, duration } = parsed.data;

      const entry = await db.playHistory.create({
        data: { trackId, duration },
      });

      return reply.status(201).send(entry);
    }
  );

  // ── GET /api/play-history/stats ───────────────────────────
  // Returns aggregated listening stats for the given period.
  fastify.get(
    '/play-history/stats',
    async (
      request: FastifyRequest<{ Querystring: { period?: string } }>,
      reply: FastifyReply
    ) => {
      const query = request.query as { period?: string };
      const period = query.period ?? 'month'; // 'month' | 'year' | 'all'

      const now = new Date();
      let since: Date;

      if (period === 'year') {
        since = new Date(now.getFullYear(), 0, 1);
      } else if (period === 'all') {
        since = new Date(0);
      } else {
        // Default: current month
        since = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const entries = await db.playHistory.findMany({
        where: { playedAt: { gte: since } },
        include: {
          track: {
            include: {
              artist: true,
              album: { select: { id: true, title: true, coverPath: true } },
            },
          },
        },
        orderBy: { playedAt: 'desc' },
      });

      // Aggregate stats
      const totalListens = entries.length;
      const totalMinutes = Math.round(entries.reduce((sum, e) => sum + e.duration, 0) / 60);

      // Top tracks
      const trackCounts = new Map<string, { count: number; track: typeof entries[0]['track'] }>();
      for (const entry of entries) {
        const existing = trackCounts.get(entry.trackId);
        if (existing) {
          existing.count++;
        } else {
          trackCounts.set(entry.trackId, { count: 1, track: entry.track });
        }
      }
      const topTracks = [...trackCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((t) => ({
          trackId: t.track.id,
          title: t.track.title,
          artist: t.track.artist.name,
          coverUrl: t.track.album?.coverPath ?? '/covers/default.jpg',
          playCount: t.count,
        }));

      // Top artists
      const artistCounts = new Map<string, { count: number; name: string; imageUrl: string | null }>();
      for (const entry of entries) {
        const existing = artistCounts.get(entry.track.artistId);
        if (existing) {
          existing.count++;
        } else {
          artistCounts.set(entry.track.artistId, {
            count: 1,
            name: entry.track.artist.name,
            imageUrl: entry.track.artist.imageUrl,
          });
        }
      }
      const topArtists = [...artistCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((a) => ({
          name: a.name,
          imageUrl: a.imageUrl ?? '/covers/default.jpg',
          playCount: a.count,
        }));

      // Top genres
      const genreCounts = new Map<string, number>();
      for (const entry of entries) {
        const genre = entry.track.genre ?? 'Unknown';
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
      const topGenres = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));

      return reply.send({
        period,
        since: since.toISOString(),
        totalListens,
        totalMinutes,
        topTracks,
        topArtists,
        topGenres,
      });
    }
  );

  done();
};

export default playHistoryRoutes;
