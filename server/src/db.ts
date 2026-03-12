/**
 * db.ts
 * ─────────────────────────────────────────────────────────────
 * Prisma Client singleton.
 *
 * Why a singleton?
 *   PrismaClient opens a connection pool to the SQLite file.
 *   Creating multiple instances (e.g., one per request) would either
 *   exhaust file handles or cause "database is locked" errors — SQLite
 *   only supports one writer at a time. A module-level singleton
 *   ensures we reuse the same connection pool for the server lifetime.
 *
 * Hot-reload safety:
 *   ts-node-dev re-requires modules on file save. Without the global
 *   cache trick, each reload would open a new PrismaClient and leak
 *   the old connection. The `global.__prisma` pattern prevents that.
 */

import { PrismaClient } from './generated/prisma';
import config from './config';

// Augment NodeJS global type to hold our cached instance
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const db: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: config.isDev
      ? [
          { emit: 'event', level: 'query' },   // Log queries in dev
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  });

// Cache on global in development to survive hot-reloads
if (config.isDev) {
  global.__prisma = db;
}

// Optional: log slow queries in development
if (config.isDev) {
  (db.$on as Function)('query', (e: { query: string; duration: number }) => {
    if (e.duration > 200) {
      // Only log queries taking longer than 200ms
      console.warn(`[DB Slow Query] ${e.duration}ms: ${e.query}`);
    }
  });
}

export default db;
