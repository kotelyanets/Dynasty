/**
 * smartPlaylists.ts — Smart Playlist routes
 * ─────────────────────────────────────────────────────────────
 * Rules-based dynamic playlists (like iTunes Smart Playlists).
 *
 * Instead of manually adding tracks, users define rules like:
 *   "All Rock tracks shorter than 3 minutes played more than 5 times"
 *
 * Endpoint:
 *   POST /api/smart-playlists/preview  → Evaluates rules, returns matching tracks
 *
 * Rule schema:
 *   { field, operator, value }
 *   field:    'genre' | 'artist' | 'duration' | 'year' | 'playCount' | 'title'
 *   operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'
 *   value:    string | number
 */

import { FastifyInstance } from 'fastify';
import db from '../db';
import { smartPlaylistPreviewSchema } from '../validation';

interface SmartPlaylistRule {
  field: 'genre' | 'artist' | 'duration' | 'year' | 'playCount' | 'title';
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | number;
}

export default async function smartPlaylistRoutes(server: FastifyInstance) {
  // ── POST /smart-playlists/preview ─────────────────────────
  server.post(
    '/smart-playlists/preview',
    async (request, reply) => {
      const parsed = smartPlaylistPreviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
      }
      const { rules, limit = 100, orderBy = 'title', orderDir = 'asc' } = parsed.data;

      try {
        // Build Prisma where clause from rules
        const where = buildWhereClause(rules);

        // Build orderBy
        const order: Record<string, 'asc' | 'desc'> = {};
        if (['title', 'duration', 'playCount'].includes(orderBy)) {
          order[orderBy] = orderDir;
        } else if (orderBy === 'year') {
          // year lives on the album, so order by title as fallback
          order.title = orderDir;
        }

        const tracks = await db.track.findMany({
          where,
          include: {
            artist: true,
            album: true,
          },
          orderBy: order,
          take: Math.min(limit, 500),
        });

        const items = tracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist.name,
          artistId: t.artistId,
          album: t.album?.title ?? 'Unknown Album',
          albumId: t.albumId ?? '',
          duration: t.duration ?? 0,
          trackNumber: t.trackNumber ?? 0,
          genre: t.genre ?? '',
          year: t.album?.year ?? 0,
          playCount: t.playCount,
          coverUrl: t.album?.coverPath ? `/covers/${t.album.coverPath}` : '',
          audioUrl: `/api/stream/${t.id}`,
        }));

        return { items, total: items.length };
      } catch (err) {
        server.log.error(err, 'Smart playlist query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );
}

/**
 * Convert an array of rules into a Prisma-compatible `where` clause.
 */
function buildWhereClause(rules: SmartPlaylistRule[]): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  for (const rule of rules) {
    const condition = buildCondition(rule);
    if (condition) conditions.push(condition);
  }

  // All rules must match (AND logic)
  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0]!;
  return { AND: conditions };
}

function buildCondition(rule: SmartPlaylistRule): Record<string, unknown> | null {
  const { field, operator, value } = rule;

  switch (field) {
    case 'genre':
      return { genre: buildStringFilter(operator, String(value)) };

    case 'title':
      return { title: buildStringFilter(operator, String(value)) };

    case 'artist':
      return { artist: { name: buildStringFilter(operator, String(value)) } };

    case 'duration':
      return { duration: buildNumericFilter(operator, Number(value)) };

    case 'year':
      return { album: { year: buildNumericFilter(operator, Number(value)) } };

    case 'playCount':
      return { playCount: buildNumericFilter(operator, Number(value)) };

    default:
      return null;
  }
}

function buildStringFilter(operator: string, value: string): Record<string, unknown> {
  switch (operator) {
    case 'equals':
      return { equals: value };
    case 'contains':
      return { contains: value };
    default:
      return { equals: value };
  }
}

function buildNumericFilter(operator: string, value: number): Record<string, unknown> {
  switch (operator) {
    case 'equals':
      return { equals: value };
    case 'gt':
      return { gt: value };
    case 'lt':
      return { lt: value };
    case 'gte':
      return { gte: value };
    case 'lte':
      return { lte: value };
    default:
      return { equals: value };
  }
}
