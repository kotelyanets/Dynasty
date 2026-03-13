/**
 * routes/collaborate.ts — Collaborative Playlist (Blend) API
 * ─────────────────────────────────────────────────────────────
 * Endpoints for managing playlist collaborators and allowing
 * multiple users to add tracks to shared playlists.
 *
 * POST   /api/playlists/:id/collaborators       — Add a collaborator
 * DELETE /api/playlists/:id/collaborators/:userId — Remove collaborator
 * GET    /api/playlists/:id/collaborators        — List collaborators
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import db from '../db';
import { z } from 'zod';

const addCollaboratorSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.enum(['editor', 'owner']).optional().default('editor'),
});

const collaborateRoutes: FastifyPluginCallback = (fastify, _opts, done) => {

  // ── GET /api/playlists/:id/collaborators ──────────────────
  fastify.get<{ Params: { id: string } }>(
    '/playlists/:id/collaborators',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const collaborators = await db.playlistCollaborator.findMany({
        where: { playlistId: request.params.id },
        orderBy: { joinedAt: 'asc' },
      });
      return reply.send(collaborators);
    }
  );

  // ── POST /api/playlists/:id/collaborators ─────────────────
  fastify.post<{ Params: { id: string }; Body: { userId: string; role?: string } }>(
    '/playlists/:id/collaborators',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { userId: string; role?: string } }>,
      reply: FastifyReply
    ) => {
      const parsed = addCollaboratorSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
      }

      const { userId, role } = parsed.data;
      const playlistId = request.params.id;

      // Verify playlist exists
      const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
      if (!playlist) {
        return reply.status(404).send({ error: 'Playlist not found' });
      }

      // Upsert collaborator
      const collaborator = await db.playlistCollaborator.upsert({
        where: { playlistId_userId: { playlistId, userId } },
        create: { playlistId, userId, role },
        update: { role },
      });

      return reply.status(201).send(collaborator);
    }
  );

  // ── DELETE /api/playlists/:id/collaborators/:userId ────────
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/playlists/:id/collaborators/:userId',
    async (
      request: FastifyRequest<{ Params: { id: string; userId: string } }>,
      reply: FastifyReply
    ) => {
      await db.playlistCollaborator.deleteMany({
        where: {
          playlistId: request.params.id,
          userId: request.params.userId,
        },
      });
      return reply.status(204).send();
    }
  );

  done();
};

export default collaborateRoutes;
