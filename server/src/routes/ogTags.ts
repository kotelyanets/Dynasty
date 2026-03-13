/**
 * routes/ogTags.ts — Rich Link Previews (Open Graph meta tags)
 * ─────────────────────────────────────────────────────────────
 * When social media bots (Telegram, Discord, Twitter, etc.) crawl
 * a shared link, they receive HTML with proper Open Graph meta tags
 * showing the album art, track name, and a "Listen" prompt.
 *
 * Detection: User-Agent sniffing for common bot crawlers.
 * Non-bot requests pass through to the SPA shell as normal.
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import db from '../db';

const BOT_UA_PATTERNS = [
  'telegrambot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'discordbot',
  'whatsapp',
  'slackbot',
  'googlebot',
  'bingbot',
  'yandex',
  'baiduspider',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_UA_PATTERNS.some((bot) => ua.includes(bot));
}

function buildOgHtml(opts: {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  type?: string;
}): string {
  const { title, description, imageUrl, url, type = 'music.song' } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="Dynasty Music" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const ogTagRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── GET /share/track/:id ──────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/share/track/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const ua = request.headers['user-agent'] ?? '';

      if (!isBot(ua)) {
        // Non-bot: redirect to the SPA
        return reply.redirect(`/?track=${request.params.id}`);
      }

      const track = await db.track.findUnique({
        where: { id: request.params.id },
        include: {
          artist: true,
          album: { select: { title: true, coverPath: true } },
        },
      });

      if (!track) {
        return reply.status(404).send({ error: 'Track not found' });
      }

      const baseUrl = `${request.protocol}://${request.hostname}`;
      const coverUrl = track.album?.coverPath
        ? `${baseUrl}${track.album.coverPath}`
        : `${baseUrl}/covers/default.jpg`;

      const html = buildOgHtml({
        title: `${track.title} — ${track.artist.name}`,
        description: `Listen to "${track.title}" by ${track.artist.name}${track.album ? ` from ${track.album.title}` : ''} on Dynasty Music`,
        imageUrl: coverUrl,
        url: `${baseUrl}/?track=${track.id}`,
        type: 'music.song',
      });

      return reply.type('text/html').send(html);
    }
  );

  // ── GET /share/album/:id ──────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/share/album/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const ua = request.headers['user-agent'] ?? '';

      if (!isBot(ua)) {
        return reply.redirect(`/?album=${request.params.id}`);
      }

      const album = await db.album.findUnique({
        where: { id: request.params.id },
        include: {
          artist: true,
          _count: { select: { tracks: true } },
        },
      });

      if (!album) {
        return reply.status(404).send({ error: 'Album not found' });
      }

      const baseUrl = `${request.protocol}://${request.hostname}`;
      const coverUrl = album.coverPath
        ? `${baseUrl}${album.coverPath}`
        : `${baseUrl}/covers/default.jpg`;

      const html = buildOgHtml({
        title: `${album.title} — ${album.artist.name}`,
        description: `${album._count.tracks} tracks${album.year ? ` (${album.year})` : ''} — Listen on Dynasty Music`,
        imageUrl: coverUrl,
        url: `${baseUrl}/?album=${album.id}`,
        type: 'music.album',
      });

      return reply.type('text/html').send(html);
    }
  );

  // ── GET /share/artist/:id ─────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/share/artist/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const ua = request.headers['user-agent'] ?? '';

      if (!isBot(ua)) {
        return reply.redirect(`/?artist=${request.params.id}`);
      }

      const artist = await db.artist.findUnique({
        where: { id: request.params.id },
        include: { _count: { select: { albums: true, tracks: true } } },
      });

      if (!artist) {
        return reply.status(404).send({ error: 'Artist not found' });
      }

      const baseUrl = `${request.protocol}://${request.hostname}`;
      const imageUrl = artist.imageUrl
        ? `${baseUrl}${artist.imageUrl}`
        : `${baseUrl}/covers/default.jpg`;

      const html = buildOgHtml({
        title: artist.name,
        description: `${artist._count.albums} albums, ${artist._count.tracks} tracks — Listen on Dynasty Music`,
        imageUrl,
        url: `${baseUrl}/?artist=${artist.id}`,
        type: 'music.musician',
      });

      return reply.type('text/html').send(html);
    }
  );

  done();
};

export default ogTagRoutes;
