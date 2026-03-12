/**
 * config.ts
 * ─────────────────────────────────────────────────────────────
 * Single place for all environment-variable access.
 * Import this instead of reading process.env directly anywhere
 * else — makes mocking in tests trivial.
 */

import path from 'path';
import dotenv from 'dotenv';

// Load .env file (no-op in production if file doesn't exist)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[Config] Missing required environment variable: ${name}\n` +
      `  Copy server/.env.example → server/.env and fill in the values.`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const config = {
  // ── Server ──────────────────────────────────────────────────
  port: parseInt(optional('PORT', '3001'), 10),
  host: optional('HOST', '0.0.0.0'), // 0.0.0.0 = accessible on local network (iPhone)

  // ── Environment ─────────────────────────────────────────────
  isDev: optional('NODE_ENV', 'development') !== 'production',

  // ── Paths ────────────────────────────────────────────────────
  // Where the scanner looks for audio files
  musicDir: optional('MUSIC_DIR', path.join(process.cwd(), 'music')),

  // Where cover art images are saved
  // Frontend accesses them at: GET /covers/<hash>.jpg
  coversDir: optional('COVERS_DIR', path.join(process.cwd(), 'public', 'covers')),

  // Static files root (parent of covers/)
  publicDir: optional('PUBLIC_DIR', path.join(process.cwd(), 'public')),

  // ── Database ─────────────────────────────────────────────────
  databaseUrl: optional('DATABASE_URL', 'file:./prisma/dev.db'),
} as const;

export default config;
export type Config = typeof config;
