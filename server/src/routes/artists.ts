/**
 * routes/artists.ts
 *
 * GET /api/artists        → All artists (with albums, without track lists)
 * GET /api/artists/:id    → Single artist with full albums + tracks
 *
 * Two-tier loading strategy:
 *   List view  → albums but tracks=[] (lightweight, instant load)
 *   Detail view → full tracks for each album (on demand)
 *
 * This matches the frontend's mapArtist/mapAlbum which handles
 * empty tracks arrays gracefully — the AlbumDetail page fetches
 * the full album independently.
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import db from '../db';
import config from '../config';

// ─────────────────────────────────────────────────────────────
//  Response shape builders
//  Mirror the ApiArtist / ApiAlbum / ApiTrack types in
//  src/types/music.ts on the frontend.
// ─────────────────────────────────────────────────────────────

function buildTrackResponse(track: {
  id: string; title: string; duration: number | null; trackNumber: number | null;
  diskNumber: number | null; genre: string | null; filePath: string;
  mimeType: string | null;
  artist: { id: string; name: string };
  album: { id: string; title: string; year: number | null; coverPath: string | null } | null;
}) {
  const coverUrl = track.album?.coverPath
    ? `${track.album.coverPath}`  // already a /covers/... path
    : '/covers/default.jpg';

  return {
    id:          track.id,
    title:       track.title,
    artist:      track.artist.name,
    artistId:    track.artist.id,
    album:       track.album?.title    ?? 'Unknown Album',
    albumId:     track.album?.id       ?? '',
    duration:    track.duration        ?? 0,
    trackNumber: track.trackNumber     ?? 0,
    diskNumber:  track.diskNumber      ?? 1,
    genre:       track.genre           ?? '',
    year:        track.album?.year     ?? 0,
    coverUrl,
    audioUrl:    `/api/stream/${track.id}`,
  };
}

function buildAlbumResponse(
  album: {
    id: string; title: string; year: number | null; genre: string | null;
    coverPath: string | null; totalTracks: number | null;
    artist: { id: string; name: string };
    tracks: Parameters<typeof buildTrackResponse>[0][];
  },
  includeTracks = false
) {
  return {
    id:         album.id,
    title:      album.title,
    artist:     album.artist.name,
    artistId:   album.artist.id,
    year:       album.year        ?? 0,
    genre:      album.genre       ?? '',
    coverUrl:   album.coverPath   ?? '/covers/default.jpg',
    trackCount: album.totalTracks ?? album.tracks.length,
    tracks:     includeTracks ? album.tracks.map(buildTrackResponse) : [],
  };
}

// ─────────────────────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────────────────────

const artistRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── GET /api/artists ──────────────────────────────────────
  fastify.get('/artists', async (_req: FastifyRequest, reply: FastifyReply) => {
    const artists = await db.artist.findMany({
      orderBy: { name: 'asc' },
      include: {
        albums: {
          orderBy: { year: 'desc' },
          include: {
            artist: true,
            tracks: false, // omit tracks on list view
            _count: { select: { tracks: true } },
          },
        },
        _count: { select: { albums: true, tracks: true } },
      },
    });

    const response = artists.map((a) => ({
      id:         a.id,
      name:       a.name,
      imageUrl:   a.imageUrl ?? (a.albums[0]?.coverPath ?? '/covers/default.jpg'),
      albumCount: a._count.albums,
      trackCount: a._count.tracks,
      albums: a.albums.map((album) => ({
        id:         album.id,
        title:      album.title,
        artist:     a.name,
        artistId:   a.id,
        year:       album.year        ?? 0,
        genre:      album.genre       ?? '',
        coverUrl:   album.coverPath   ?? '/covers/default.jpg',
        trackCount: album._count.tracks,
        tracks:     [],
      })),
    }));

    return reply.send(response);
  });

  // ── GET /api/artists/:id ──────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/artists/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const artist = await db.artist.findUnique({
        where: { id: request.params.id },
        include: {
          albums: {
            orderBy: { year: 'desc' },
            include: {
              artist: true,
              tracks: {
                orderBy: [{ diskNumber: 'asc' }, { trackNumber: 'asc' }],
                include: { artist: true, album: true },
              },
            },
          },
          _count: { select: { albums: true, tracks: true } },
        },
      });

      if (!artist) {
        return reply.status(404).send({ error: 'Artist not found' });
      }

      return reply.send({
        id:         artist.id,
        name:       artist.name,
        imageUrl:   artist.imageUrl ?? (artist.albums[0]?.coverPath ?? '/covers/default.jpg'),
        albumCount: artist._count.albums,
        trackCount: artist._count.tracks,
        albums:     artist.albums.map((album) =>
          buildAlbumResponse(album, true)
        ),
      });
    }
  );

  done();
};

export default artistRoutes;
