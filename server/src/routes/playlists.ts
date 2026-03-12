/**
 * routes/playlists.ts
 *
 * GET    /api/playlists              → All playlists (without tracks)
 * POST   /api/playlists              → Create playlist
 * GET    /api/playlists/:id          → Single playlist with ordered tracks
 * PATCH  /api/playlists/:id          → Rename / update description
 * DELETE /api/playlists/:id          → Delete playlist (cascade cleans join rows)
 * POST   /api/playlists/:id/tracks   → Add track(s)
 * DELETE /api/playlists/:id/tracks/:trackId → Remove track
 * PUT    /api/playlists/:id/reorder  → Reorder: send { trackIds: string[] }
 */

import type {
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import db from '../db';

const TRACK_SELECT = {
  id:          true,
  title:       true,
  duration:    true,
  trackNumber: true,
  diskNumber:  true,
  genre:       true,
  playCount:   true,
  artist: { select: { id: true, name: true } },
  album:  { select: { id: true, title: true, year: true, coverPath: true } },
} as const;

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
    genre:       t.genre           ?? '',
    year:        t.album?.year     ?? 0,
    coverUrl:    t.album?.coverPath ?? '/covers/default.jpg',
    audioUrl:    `/api/stream/${t.id}`,
    playCount:   t.playCount,
  };
}

// ─────────────────────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────────────────────

const playlistRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── GET /api/playlists ────────────────────────────────────
  fastify.get('/playlists', async (_req: FastifyRequest, reply: FastifyReply) => {
    const playlists = await db.playlist.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { tracks: true } } },
    });

    return reply.send(
      playlists.map((p) => ({
        id:          p.id,
        name:        p.name,
        description: p.description ?? '',
        coverUrl:    p.coverPath   ?? '/covers/default.jpg',
        trackCount:  p._count.tracks,
        trackIds:    [], // Not included on list view
        createdAt:   p.createdAt.toISOString(),
      }))
    );
  });

  // ── POST /api/playlists ───────────────────────────────────
  fastify.post('/playlists', async (
    request: FastifyRequest<{ Body: { name: string; description?: string } }>,
    reply: FastifyReply
  ) => {
    const body = request.body as { name?: string; description?: string };
    if (!body.name?.trim()) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const playlist = await db.playlist.create({
      data: {
        name:        body.name.trim(),
        description: body.description?.trim() ?? null,
      },
    });

    return reply.status(201).send({
      id:          playlist.id,
      name:        playlist.name,
      description: playlist.description ?? '',
      coverUrl:    '/covers/default.jpg',
      trackIds:    [],
      createdAt:   playlist.createdAt.toISOString(),
    });
  });

  // ── GET /api/playlists/:id ────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/playlists/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const playlist = await db.playlist.findUnique({
        where: { id: request.params.id },
        include: {
          tracks: {
            orderBy: { position: 'asc' },
            include: { track: { select: TRACK_SELECT } },
          },
        },
      });

      if (!playlist) return reply.status(404).send({ error: 'Playlist not found' });

      const tracks = playlist.tracks.map((pt) => buildTrack(pt.track));

      return reply.send({
        id:          playlist.id,
        name:        playlist.name,
        description: playlist.description ?? '',
        coverUrl:    playlist.coverPath ?? (tracks[0]?.coverUrl ?? '/covers/default.jpg'),
        trackIds:    tracks.map((t) => t.id),
        tracks,
        createdAt:   playlist.createdAt.toISOString(),
      });
    }
  );

  // ── PATCH /api/playlists/:id ──────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/playlists/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply
    ) => {
      const body = request.body as { name?: string; description?: string };
      const updated = await db.playlist.update({
        where: { id: request.params.id },
        data: {
          ...(body.name        !== undefined && { name:        body.name.trim() }),
          ...(body.description !== undefined && { description: body.description }),
        },
      }).catch(() => null);

      if (!updated) return reply.status(404).send({ error: 'Playlist not found' });
      return reply.send({ id: updated.id, name: updated.name });
    }
  );

  // ── DELETE /api/playlists/:id ─────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/playlists/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await db.playlist.delete({ where: { id: request.params.id } }).catch(() => null);
      return reply.status(204).send();
    }
  );

  // ── POST /api/playlists/:id/tracks ────────────────────────
  // Body: { trackIds: string[] }
  fastify.post<{ Params: { id: string } }>(
    '/playlists/:id/tracks',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply
    ) => {
      const body = request.body as { trackIds?: string[] };
      const trackIds = body.trackIds;
      if (!Array.isArray(trackIds) || trackIds.length === 0) {
        return reply.status(400).send({ error: 'trackIds[] is required' });
      }

      const playlistId = request.params.id;

      // Get the current max position to append at the end
      const lastRow = await db.playlistTrack.findFirst({
        where:   { playlistId },
        orderBy: { position: 'desc' },
        select:  { position: true },
      });
      let nextPosition = (lastRow?.position ?? -1) + 1;

      // Insert tracks that aren't already in the playlist
      const existing = await db.playlistTrack.findMany({
        where:  { playlistId },
        select: { trackId: true },
      });
      const existingIds = new Set(existing.map((r) => r.trackId));

      const newTracks = trackIds
        .filter((id) => !existingIds.has(id))
        .map((trackId) => ({
          playlistId,
          trackId,
          position: nextPosition++,
        }));

      if (newTracks.length > 0) {
        await db.playlistTrack.createMany({ data: newTracks });
      }

      return reply.status(201).send({ added: newTracks.length });
    }
  );

  // ── DELETE /api/playlists/:id/tracks/:trackId ─────────────
  fastify.delete<{ Params: { id: string; trackId: string } }>(
    '/playlists/:id/tracks/:trackId',
    async (
      request: FastifyRequest<{ Params: { id: string; trackId: string } }>,
      reply: FastifyReply
    ) => {
      const { id: playlistId, trackId } = request.params;
      await db.playlistTrack
        .deleteMany({ where: { playlistId, trackId } })
        .catch(() => null);

      // Compact positions after deletion to avoid gaps
      const remaining = await db.playlistTrack.findMany({
        where:   { playlistId },
        orderBy: { position: 'asc' },
        select:  { id: true },
      });
      await Promise.all(
        remaining.map((row, i) =>
          db.playlistTrack.update({ where: { id: row.id }, data: { position: i } })
        )
      );

      return reply.status(204).send();
    }
  );

  // ── PUT /api/playlists/:id/reorder ────────────────────────
  // Body: { trackIds: string[] } — the full ordered list
  fastify.put<{ Params: { id: string } }>(
    '/playlists/:id/reorder',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply
    ) => {
      const body = request.body as { trackIds?: string[] };
      const trackIds = body.trackIds;
      if (!Array.isArray(trackIds)) {
        return reply.status(400).send({ error: 'trackIds[] is required' });
      }

      const playlistId = request.params.id;

      // Update each track's position in a transaction
      await db.$transaction(
        trackIds.map((trackId, position) =>
          db.playlistTrack.updateMany({
            where: { playlistId, trackId },
            data:  { position },
          })
        )
      );

      return reply.send({ ok: true, reordered: trackIds.length });
    }
  );

  done();
};

export default playlistRoutes;
