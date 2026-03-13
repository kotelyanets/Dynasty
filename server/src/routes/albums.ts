/**
 * routes/albums.ts
 *
 * GET /api/albums           → All albums (without tracks, for grid views)
 * GET /api/albums/:id       → Single album + full ordered track list
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import db from '../db';

const albumRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── GET /api/albums ───────────────────────────────────────
  fastify.get('/albums', async (
    request: FastifyRequest<{
      Querystring: { artistId?: string; genre?: string; year?: string }
    }>,
    reply: FastifyReply
  ) => {
    const { artistId, genre, year } = request.query as {
      artistId?: string; genre?: string; year?: string;
    };

    const albums = (await db.album.findMany({
      where: {
        ...(artistId && { artistId }),
        ...(genre    && { genre }),
        ...(year     && { year: parseInt(year, 10) }),
      },
      orderBy: [{ year: 'desc' }, { title: 'asc' }],
      include: {
        artist: true,
        _count: { select: { tracks: true } },
      },
    })) as any[];

    // Deduplicate albums that are practically identical.
    // Primary key: title + artist (handles casing/whitespace differences).
    // Secondary key: title + cover art (catches albums split across
    // different artist records due to inconsistent track-level artist tags).
    const seenByTitleArtist = new Set<string>();
    const seenByTitleCover  = new Set<string>();
    const deduplicated = albums.filter((a) => {
      const titleNorm = a.title.trim().toLowerCase();
      const artistNorm = a.artist.name.trim().toLowerCase();

      const keyByArtist = `${titleNorm}::${artistNorm}`;
      if (seenByTitleArtist.has(keyByArtist)) return false;
      seenByTitleArtist.add(keyByArtist);

      // Cover-based dedup: same title + same cover ≈ same album
      if (a.coverPath) {
        const keyByCover = `${titleNorm}::${a.coverPath}`;
        if (seenByTitleCover.has(keyByCover)) return false;
        seenByTitleCover.add(keyByCover);
      }

      return true;
    });

    return reply.send(
      deduplicated.map((a: any) => ({
        id:         a.id,
        title:      a.title,
        artist:     a.artist.name,
        artistId:   a.artist.id,
        year:       a.year        ?? 0,
        genre:      a.genre       ?? '',
        coverUrl:   a.coverPath   ?? '/covers/default.jpg',
        trackCount: a._count.tracks,
        tracks:     [],
      }))
    );
  });

  // ── GET /api/albums/:id ───────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/albums/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const album = await db.album.findUnique({
        where: { id: request.params.id },
        include: {
          artist: true,
          tracks: {
            // Disc 1 Track 1 → Disc 1 Track 2 → Disc 2 Track 1 …
            orderBy: [{ diskNumber: 'asc' }, { trackNumber: 'asc' }, { title: 'asc' }],
            include: { artist: true, album: true },
          },
        },
      });

      if (!album) {
        return reply.status(404).send({ error: 'Album not found' });
      }

      return reply.send({
        id:         album.id,
        title:      album.title,
        artist:     album.artist.name,
        artistId:   album.artist.id,
        year:       album.year         ?? 0,
        genre:      album.genre        ?? '',
        coverUrl:   album.coverPath    ?? '/covers/default.jpg',
        trackCount: album.tracks.length,
        tracks: album.tracks.map((t) => ({
          id:          t.id,
          title:       t.title,
          artist:      t.artist.name,
          artistId:    t.artist.id,
          album:       album.title,
          albumId:     album.id,
          duration:    t.duration    ?? 0,
          trackNumber: t.trackNumber ?? 0,
          diskNumber:  t.diskNumber  ?? 1,
          genre:       t.genre       ?? '',
          year:        album.year    ?? 0,
          coverUrl:    album.coverPath ?? '/covers/default.jpg',
          audioUrl:    `/api/stream/${t.id}`,
        })),
      });
    }
  );

  done();
};

export default albumRoutes;
