/**
 * routes/recommendations.ts
 *
 * GET /api/tracks/similar?trackId=xxx&limit=10
 *   → Returns random tracks with the same genre or by the same artist,
 *     excluding the source track itself. Used by the ♾️ Infinite Autoplay
 *     feature to keep music going when the queue runs out.
 */

import type {
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import db from '../db';

// Same response builder used in tracks.ts — duplicated here to avoid
// cross-module coupling.  A shared helper module can be factored out later.
function buildTrack(t: {
  id: string; title: string; duration: number | null; trackNumber: number | null;
  diskNumber: number | null; genre: string | null; playCount: number;
  artist: { id: string; name: string };
  album: { id: string; title: string; year: number | null; coverPath: string | null } | null;
}) {
  return {
    id:          t.id,
    title:       t.title,
    artist:      t.artist.name,
    artistId:    t.artist.id,
    album:       t.album?.title    ?? 'Unknown Album',
    albumId:     t.album?.id       ?? '',
    duration:    t.duration        ?? 0,
    trackNumber: t.trackNumber     ?? 0,
    diskNumber:  t.diskNumber      ?? 1,
    genre:       t.genre           ?? '',
    year:        t.album?.year     ?? 0,
    coverUrl:    t.album?.coverPath ?? '/covers/default.jpg',
    audioUrl:    `/api/stream/${t.id}`,
    playCount:   t.playCount,
  };
}

const TRACK_INCLUDE = {
  artist: true,
  album: { select: { id: true, title: true, year: true, coverPath: true } },
} as const;

// ─────────────────────────────────────────────────────────────
//  Route
// ─────────────────────────────────────────────────────────────

const recommendationRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  fastify.get('/tracks/similar', async (
    request: FastifyRequest<{
      Querystring: { trackId?: string; limit?: string };
    }>,
    reply: FastifyReply,
  ) => {
    const query = request.query as { trackId?: string; limit?: string };
    const trackId = query.trackId;
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '10', 10)));

    if (!trackId) {
      return reply.status(400).send({ error: 'trackId query parameter is required' });
    }

    // Fetch the source track to determine its genre and artist
    const sourceTrack = await db.track.findUnique({
      where: { id: trackId },
      select: { id: true, genre: true, artistId: true },
    });

    if (!sourceTrack) {
      return reply.status(404).send({ error: 'Track not found' });
    }

    // Build OR conditions: same genre and/or same artist
    const orConditions: object[] = [];
    if (sourceTrack.genre) {
      orConditions.push({ genre: sourceTrack.genre });
    }
    orConditions.push({ artistId: sourceTrack.artistId });

    // Fetch more tracks than requested so we can shuffle for variety
    const poolSize = limit * 3;
    const candidates = await db.track.findMany({
      where: {
        id: { not: trackId },
        OR: orConditions,
      },
      take: poolSize,
      include: TRACK_INCLUDE,
    });

    // Fisher–Yates shuffle for uniform randomness
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = candidates[i]!;
      candidates[i] = candidates[j]!;
      candidates[j] = tmp;
    }

    const result = candidates.slice(0, limit).map(buildTrack);

    return reply.send({ items: result });
  });

  done();
};

export default recommendationRoutes;
