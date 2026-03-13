/**
 * routes/seekEvents.ts — Track Heatmap (Replay Drops)
 * ─────────────────────────────────────────────────────────────
 * Records seek actions and generates heatmap data showing
 * which moments of a track are most frequently jumped to.
 *
 * POST /api/seek-events                  — Record a seek action
 * GET  /api/seek-events/:trackId/heatmap — Get heatmap data
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import db from '../db';
import { z } from 'zod';

const seekEventSchema = z.object({
  trackId: z.string().min(1),
  timestamp: z.number().min(0, 'Timestamp must be >= 0'),
});

const seekEventRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── POST /api/seek-events ─────────────────────────────────
  fastify.post(
    '/seek-events',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = seekEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
      }

      const { trackId, timestamp } = parsed.data;

      await db.seekEvent.create({
        data: { trackId, timestamp },
      });

      return reply.status(201).send({ ok: true });
    }
  );

  // ── GET /api/seek-events/:trackId/heatmap ─────────────────
  // Returns an array of normalized intensity values (0-1) for
  // N buckets across the track duration. Each bucket represents
  // a time segment of the track.
  fastify.get<{ Params: { trackId: string }; Querystring: { buckets?: string } }>(
    '/seek-events/:trackId/heatmap',
    async (
      request: FastifyRequest<{ Params: { trackId: string }; Querystring: { buckets?: string } }>,
      reply: FastifyReply
    ) => {
      const { trackId } = request.params;
      const query = request.query as { buckets?: string };
      const numBuckets = Math.min(100, Math.max(10, parseInt(query.buckets ?? '50', 10)));

      // Get track duration
      const track = await db.track.findUnique({
        where: { id: trackId },
        select: { duration: true },
      });

      if (!track || !track.duration) {
        return reply.send({ buckets: new Array(numBuckets).fill(0), trackId });
      }

      // Get all seek events for this track
      const events = await db.seekEvent.findMany({
        where: { trackId },
        select: { timestamp: true },
      });

      if (events.length === 0) {
        return reply.send({ buckets: new Array(numBuckets).fill(0), trackId });
      }

      // Build histogram
      const bucketSize = track.duration / numBuckets;
      const histogram = new Array(numBuckets).fill(0);

      for (const event of events) {
        const bucketIndex = Math.min(
          numBuckets - 1,
          Math.floor(event.timestamp / bucketSize)
        );
        histogram[bucketIndex]++;
      }

      // Normalize to 0-1 range
      const maxCount = Math.max(...histogram);
      const normalized = maxCount > 0
        ? histogram.map((count: number) => Math.round((count / maxCount) * 100) / 100)
        : histogram;

      return reply.send({
        buckets: normalized,
        trackId,
        totalSeeks: events.length,
      });
    }
  );

  done();
};

export default seekEventRoutes;
