/**
 * validation.ts — Zod schemas for request validation
 * ─────────────────────────────────────────────────────────────
 * Centralised input validation using Zod.
 * Every request body that reaches a route handler is validated
 * against a strict schema before touching the database.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
//  Tracks
// ─────────────────────────────────────────────────────────────

export const likeBodySchema = z.object({
  isLiked: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
//  Playlists
// ─────────────────────────────────────────────────────────────

export const createPlaylistSchema = z.object({
  name:        z.string().min(1, 'name is required').max(200),
  description: z.string().max(1000).optional(),
});

export const updatePlaylistSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const trackIdsSchema = z.object({
  trackIds: z.array(z.string().min(1)).min(1, 'trackIds[] is required'),
});

export const reorderSchema = z.object({
  trackIds: z.array(z.string().min(1)),
});

// ─────────────────────────────────────────────────────────────
//  Smart Playlists
// ─────────────────────────────────────────────────────────────

const smartPlaylistRuleSchema = z.object({
  field:    z.enum(['genre', 'artist', 'duration', 'year', 'playCount', 'title']),
  operator: z.enum(['equals', 'contains', 'gt', 'lt', 'gte', 'lte']),
  value:    z.union([z.string(), z.number()]),
});

export const smartPlaylistPreviewSchema = z.object({
  rules:    z.array(smartPlaylistRuleSchema).min(1, 'At least one rule is required'),
  limit:    z.number().int().min(1).max(500).optional(),
  orderBy:  z.enum(['title', 'duration', 'playCount', 'year']).optional(),
  orderDir: z.enum(['asc', 'desc']).optional(),
});

// ─────────────────────────────────────────────────────────────
//  Push Notifications
// ─────────────────────────────────────────────────────────────

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url('Invalid subscription endpoint'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }).optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url('Missing endpoint'),
});

// ─────────────────────────────────────────────────────────────
//  Cover image resize query
// ─────────────────────────────────────────────────────────────

export const coverResizeQuerySchema = z.object({
  w:      z.coerce.number().int().min(16).max(2048).optional(),
  h:      z.coerce.number().int().min(16).max(2048).optional(),
  format: z.enum(['webp', 'jpeg', 'png']).optional(),
  q:      z.coerce.number().int().min(1).max(100).optional(),
});
