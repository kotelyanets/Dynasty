/**
 * index.ts — Vault Music Server
 * ─────────────────────────────────────────────────────────────
 * Fastify application bootstrap.
 *
 * Plugin registration order matters:
 *   1. CORS              — must come before all routes so preflight
 *                          OPTIONS requests get the right headers.
 *   2. Static files      — serves /covers/* from public/covers/
 *   3. Route plugins     — register under /api prefix
 *   4. Global error hook — consistent JSON error responses
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import config from './config';
import db from './db';

// Route modules
import streamRoutes         from './routes/stream';
import artistRoutes         from './routes/artists';
import albumRoutes          from './routes/albums';
import trackRoutes          from './routes/tracks';
import playlistRoutes       from './routes/playlists';
import recommendationRoutes from './routes/recommendations';

// ─────────────────────────────────────────────────────────────
//  Build the Fastify instance
//  Exported for testing (can be imported and used with inject())
// ─────────────────────────────────────────────────────────────

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: config.isDev
      ? {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize:      true,
              translateTime: 'HH:MM:ss',
              ignore:        'pid,hostname',
            },
          },
        }
      : { level: 'warn' },

    // Important for iOS: sets proper HTTP/1.1 keep-alive behaviour
    keepAliveTimeout:    65_000,
    connectionTimeout:  130_000,
  });

  // ── CORS ──────────────────────────────────────────────────
  // `origin: true` mirrors the request origin — correct for a
  // local-network PWA served from the same server as the API.
  // The iPhone PWA's origin will be e.g. http://192.168.1.x:3001
  await server.register(cors, {
    origin:         true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type', 'Authorization',
      'Range',                // Required for audio range requests
      'If-None-Match',        // For conditional GET (ETag)
      'If-Modified-Since',
    ],
    exposedHeaders: [
      'Content-Range',        // Must be exposed for the browser to read it
      'Content-Length',
      'Accept-Ranges',
      'Content-Type',
      'ETag',
    ],
    credentials: false,      // No credentials needed for a personal server
    maxAge:       86_400,    // Cache preflight for 24 hours
  });

  // ── Static files (cover art) ──────────────────────────────
  // GET /covers/<hash>.jpg → serves from COVERS_DIR
  await server.register(fastifyStatic, {
    root:          config.coversDir,
    prefix:        '/covers/',
    decorateReply: false,   // Don't add sendFile() helper for this instance
    cacheControl:  true,
    maxAge:        '30d',   // Cover art is immutable (content-addressed by hash)
    immutable:     true,
  });

  // ── API / streaming routes ────────────────────────────────
  // Streaming has no /api prefix — URL is /api/stream/:id from root
  await server.register(streamRoutes);

  // All other routes are under /api
  await server.register(artistRoutes,         { prefix: '/api' });
  await server.register(albumRoutes,          { prefix: '/api' });
  await server.register(trackRoutes,          { prefix: '/api' });
  await server.register(playlistRoutes,       { prefix: '/api' });
  await server.register(recommendationRoutes, { prefix: '/api' });

  // ── Frontend static assets (Vite build) ───────────────────
  //
  // The compiled PWA lives in ../dist relative to the server folder.
  // This registration MUST come after all /api and /covers routes so
  // those endpoints keep taking precedence.
  const frontendDistRoot = path.resolve(__dirname, '..', '..', 'dist');

  await server.register(fastifyStatic, {
    root:          frontendDistRoot,
    prefix:        '/',          // Serve index.html, assets, etc. from /
    decorateReply: false,
    cacheControl:  true,
    maxAge:        '1d',
  });

  // ── Health check ──────────────────────────────────────────
  server.get('/health', async () => ({
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  }));

  // ── 404 handler & SPA catch-all ───────────────────────────
  const indexHtmlPath = path.join(frontendDistRoot, 'index.html');

  server.setNotFoundHandler(async (request, reply) => {
    // API and cover assets still return JSON 404s
    if (request.url.startsWith('/api/') || request.url.startsWith('/covers/')) {
      return reply
        .status(404)
        .send({ error: 'Not Found', path: request.url });
    }

    // For any other path, return the SPA shell so React Router can handle it
    try {
      const stream = fs.createReadStream(indexHtmlPath);
      reply.type('text/html; charset=utf-8');
      return reply.send(stream);
    } catch (err) {
      server.log.error({ err }, 'Failed to stream index.html');
      return reply
        .status(500)
        .send({ error: 'Failed to load application shell' });
    }
  });

  // ── Global error handler ──────────────────────────────────
  server.setErrorHandler(async (error, request, reply) => {
    server.log.error({ err: error, url: request.url }, 'Unhandled error');

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error:   error.message ?? 'Internal Server Error',
      status:  statusCode,
    });
  });

  return server;
}

// ─────────────────────────────────────────────────────────────
//  Start the server
// ─────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  let server: FastifyInstance | undefined;

  try {
    server = await buildServer();

    await server.listen({
      port: config.port,
      host: config.host,    // 0.0.0.0 = accessible on local network
    });

    console.log('\n');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   🎵  Vault Music Server — Running           ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${config.port}             ║`);
    console.log(`║  Network: http://0.0.0.0:${config.port}               ║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Music:   ${config.musicDir.substring(0, 32).padEnd(32)}  ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('\n  → Set VITE_API_URL=http://<your-ip>:3001 in the frontend .env');
    console.log('  → Run the scanner: npm run scan\n');

  } catch (err) {
    console.error('Fatal: server failed to start:', err);
    await db.$disconnect().catch(() => {});
    process.exit(1);
  }

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    try {
      await server?.close();
      await db.$disconnect();
      console.log('Server closed. Bye! 👋');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
