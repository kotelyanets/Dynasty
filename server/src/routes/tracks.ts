/**
 * routes/tracks.ts
 *
 * GET  /api/tracks          → Paginated track list (server-side pagination
 *                             is REQUIRED — a 10,000-song library cannot be
 *                             sent in one response). Uses cursor or offset.
 * GET  /api/tracks/:id      → Single track
 * GET  /api/search          → Full-text search across title, artist, album
 * POST /api/tracks/:id/play → Increment play count (called by the player)
 */

import type {
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import db from '../db';

// ─────────────────────────────────────────────────────────────
//  Track response builder
// ─────────────────────────────────────────────────────────────

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
//  Routes
// ─────────────────────────────────────────────────────────────

const trackRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── GET /api/tracks ───────────────────────────────────────
  fastify.get('/tracks', async (
    request: FastifyRequest<{
      Querystring: {
        page?: string;
        pageSize?: string;
        artistId?: string;
        albumId?: string;
        sort?: 'title' | 'artist' | 'album' | 'duration' | 'recent';
      };
    }>,
    reply: FastifyReply
  ) => {
    const query = request.query as {
      page?: string; pageSize?: string;
      artistId?: string; albumId?: string;
      sort?: string;
    };

    const page     = Math.max(0, parseInt(query.page     ?? '0',  10));
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize ?? '50', 10)));
    const skip     = page * pageSize;

    const where = {
      ...(query.artistId && { artistId: query.artistId }),
      ...(query.albumId  && { albumId:  query.albumId }),
    };

    // Sort options
    type OrderBy = Record<string, 'asc' | 'desc'>;
    const orderByMap: Record<string, OrderBy[]> = {
      title:    [{ title:   'asc'  }],
      artist:   [{ artist:  { name: 'asc' } } as unknown as OrderBy],
      album:    [{ album:   { title: 'asc' } } as unknown as OrderBy, { trackNumber: 'asc' }],
      duration: [{ duration: 'desc' }],
      recent:   [{ lastPlayed: 'desc' }],
    };
    const orderBy = orderByMap[query.sort ?? 'title'] ?? orderByMap['title']!;

    const [total, tracks] = await Promise.all([
      db.track.count({ where }),
      db.track.findMany({
        where,
        skip,
        take:    pageSize,
        orderBy,
        include: TRACK_INCLUDE,
      }),
    ]);

    return reply.send({
      items:    tracks.map(buildTrack),
      total,
      page,
      pageSize,
      pages:    Math.ceil(total / pageSize),
    });
  });

  // ── GET /api/search ───────────────────────────────────────
  // SQLite LIKE is case-insensitive for ASCII but NOT for
  // Unicode/Cyrillic. We work around this without a migration
  // by expanding the query into three capitalization variants
  // and OR-ing them all together in Prisma.
  fastify.get('/search', async (
    request: FastifyRequest<{ Querystring: { q?: string; limit?: string } }>,
    reply: FastifyReply
  ) => {
    const queryParams = (request.query as { q?: string; limit?: string });
    const q           = queryParams.q?.trim() ?? '';
    const limit       = Math.min(50, parseInt(queryParams.limit ?? '20', 10));

    if (q.length < 1) {
      return reply.send({ tracks: [], albums: [], artists: [] });
    }

    // Build case permutations to handle Cyrillic/Unicode case-insensitivity
    // on SQLite (which only does ASCII case-folding in LIKE by default).
    const qLower     = q.toLowerCase();
    const qUpper     = q.toUpperCase();
    const qTitleCase = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
    // Deduplicate so we don't send redundant queries for pure-ASCII terms.
    const variants   = [...new Set([q, qLower, qUpper, qTitleCase])];

    // Build a Prisma OR clause for every variant × every field.
    const titleVariants    = variants.map((v) => ({ contains: v }));
    const trackOr  = titleVariants.flatMap((cond) => [
      { title:  cond },
      { artist: { name: cond } },
      { album:  { title: cond } },
      { lyrics: cond },
    ]);
    const albumOr  = titleVariants.flatMap((cond) => [
      { title:  cond },
      { artist: { name: cond } },
    ]);
    const artistOr = titleVariants.map((cond) => ({ name: cond }));

    const [rawTracks, rawAlbums, rawArtists] = await Promise.all([
      db.track.findMany({
        where:   { OR: trackOr },
        take:    limit,
        include: TRACK_INCLUDE,
        orderBy: { playCount: 'desc' },
      }),

      db.album.findMany({
        where:   { OR: albumOr },
        take:    limit, // fetch more since we deduplicate
        include: {
          artist: true,
          _count: { select: { tracks: true } },
        },
        orderBy: { title: 'asc' },
      }),

      db.artist.findMany({
        where:   { OR: artistOr },
        take:    limit, // fetch more since we deduplicate
        include: { _count: { select: { albums: true, tracks: true } } },
        orderBy: { name: 'asc' },
      }),
    ]) as [any[], any[], any[]];

    // Deduplicate search results by name to avoid identically named collaborations
    const seenAlbums = new Set<string>();
    const deduplicatedAlbums = rawAlbums.filter((a: any) => {
      const key = `${a.title.trim().toLowerCase()}::${a.artist.name.trim().toLowerCase()}`;
      if (!seenAlbums.has(key)) {
        seenAlbums.add(key);
        return true;
      }
      return false;
    });

    const seenArtists = new Set<string>();
    const deduplicatedArtists = rawArtists.filter((a: any) => {
      const key = a.name.trim().toLowerCase();
      if (!seenArtists.has(key)) {
        seenArtists.add(key);
        return true;
      }
      return false;
    });

    return reply.send({
      tracks:  rawTracks.map(buildTrack),
      albums:  deduplicatedAlbums.slice(0, Math.floor(limit / 2)).map((a: any) => ({
        id:         a.id,
        title:      a.title,
        artist:     a.artist.name,
        artistId:   a.artist.id,
        year:       a.year       ?? 0,
        genre:      a.genre      ?? '',
        coverUrl:   a.coverPath  ?? '/covers/default.jpg',
        trackCount: a._count.tracks,
        tracks:     [],
      })),
      artists: deduplicatedArtists.slice(0, Math.floor(limit / 4)).map((a: any) => ({
        id:         a.id,
        name:       a.name,
        imageUrl:   a.imageUrl ?? '/covers/default.jpg',
        albumCount: a._count.albums,
        trackCount: a._count.tracks,
        albums:     [],
      })),
    });
  });

  // ── GET /api/tracks/:id ───────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/tracks/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const track = await db.track.findUnique({
        where:   { id: request.params.id },
        include: TRACK_INCLUDE,
      });
      if (!track) return reply.status(404).send({ error: 'Track not found' });
      return reply.send(buildTrack(track));
    }
  );

  // ── POST /api/tracks/:id/play ─────────────────────────────
  // Called by the player when a track starts. This is the
  // authoritative increment (not the streaming endpoint's fire-
  // and-forget) for analytics accuracy.
  fastify.post<{ Params: { id: string } }>(
    '/tracks/:id/play',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const updated = await db.track.update({
        where: { id: request.params.id },
        data:  { playCount: { increment: 1 }, lastPlayed: new Date() },
        select: { id: true, playCount: true, lastPlayed: true },
      }).catch(() => null);

      if (!updated) return reply.status(404).send({ error: 'Track not found' });
      return reply.send(updated);
    }
  );

  done();
};

export default trackRoutes;
