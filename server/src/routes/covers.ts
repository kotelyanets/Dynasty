/**
 * routes/covers.ts — On-the-fly cover image resizing
 * ─────────────────────────────────────────────────────────────
 * Uses sharp to resize album artwork on the fly.
 *
 * GET /api/covers/:filename?w=100&h=100&format=webp&q=80
 *
 * If no resize params are given, serves the original file.
 * Resized images are converted to WebP by default for smaller payloads.
 */

import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import config from '../config';
import { coverResizeQuerySchema } from '../validation';

export default async function coverRoutes(server: FastifyInstance) {
  server.get<{
    Params: { filename: string };
    Querystring: { w?: string; h?: string; format?: string; q?: string };
  }>('/covers/:filename', async (request, reply) => {
    const { filename } = request.params;

    // Sanitise filename: only allow alphanumeric, dash, underscore, dot
    if (!/^[\w\-.]+$/.test(filename)) {
      return reply.status(400).send({ error: 'Invalid filename' });
    }

    const filePath = path.join(config.coversDir, filename);

    // Check file exists
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return reply.status(404).send({ error: 'Cover not found' });
    }

    // Parse and validate resize query params
    const parsed = coverResizeQuerySchema.safeParse(request.query);
    const params = parsed.success ? parsed.data : {};
    const width  = params.w;
    const height = params.h;
    const format = params.format ?? 'webp';
    const quality = params.q ?? 80;

    // No resize needed — let the static plugin handle it
    if (!width && !height) {
      const stream = fs.createReadStream(filePath);
      reply.type(getMimeType(filename));
      reply.header('Cache-Control', 'public, max-age=2592000, immutable');
      return reply.send(stream);
    }

    // Resize with sharp
    try {
      let pipeline = sharp(filePath).resize(width, height, {
        fit:             'cover',
        withoutEnlargement: true,
      });

      const mimeMap: Record<string, string> = {
        webp: 'image/webp',
        jpeg: 'image/jpeg',
        png:  'image/png',
      };

      if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      } else if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality });
      } else {
        pipeline = pipeline.png();
      }

      const buffer = await pipeline.toBuffer();

      reply.type(mimeMap[format] ?? 'image/webp');
      reply.header('Cache-Control', 'public, max-age=2592000, immutable');
      return reply.send(buffer);
    } catch (err) {
      server.log.error(err, 'Cover resize failed');
      // Fall back to the original file
      const stream = fs.createReadStream(filePath);
      reply.type(getMimeType(filename));
      return reply.send(stream);
    }
  });
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
  };
  return map[ext] ?? 'application/octet-stream';
}
