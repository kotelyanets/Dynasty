/**
 * routes/lyrics.ts
 *
 * GET  /api/lyrics/:trackId  → Raw LRC text (or 404 if not found)
 *
 * Looks for a .lrc file alongside the audio file on disk.
 * For example, if the track's filePath is "/music/song.flac",
 * this checks for "/music/song.lrc".
 */

import type {
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import fs from 'fs';
import path from 'path';
import db from '../db';

const lyricsRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  fastify.get<{ Params: { trackId: string } }>(
    '/lyrics/:trackId',
    async (request: FastifyRequest<{ Params: { trackId: string } }>, reply: FastifyReply) => {
      const { trackId } = request.params;

      const track = await db.track.findUnique({
        where: { id: trackId },
        select: { filePath: true },
      });

      if (!track) {
        return reply.status(404).send({ error: 'Track not found' });
      }

      // Look for .lrc file alongside the audio file
      const ext = path.extname(track.filePath);
      const lrcPath = track.filePath.slice(0, -ext.length) + '.lrc';

      try {
        await fs.promises.access(lrcPath, fs.constants.R_OK);
        const content = await fs.promises.readFile(lrcPath, 'utf-8');
        return reply
          .type('text/plain; charset=utf-8')
          .header('Cache-Control', 'public, max-age=86400')
          .send(content);
      } catch {
        return reply.status(404).send({ error: 'Lyrics not found' });
      }
    },
  );

  done();
};

export default lyricsRoutes;
