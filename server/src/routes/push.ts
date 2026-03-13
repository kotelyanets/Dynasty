/**
 * push.ts — Push Notification routes
 * ─────────────────────────────────────────────────────────────
 * Manages Web Push subscriptions for the PWA.
 *
 * Endpoints:
 *   GET  /api/push/vapid-public-key   → VAPID public key for the client
 *   POST /api/push/subscribe          → Store a push subscription
 *   POST /api/push/unsubscribe        → Remove a push subscription
 *
 * VAPID keys should be set via environment variables:
 *   VAPID_PUBLIC_KEY  — base64url-encoded public key
 *   VAPID_PRIVATE_KEY — base64url-encoded private key
 *   VAPID_EMAIL       — contact email for VAPID
 *
 * Generate keys: npx web-push generate-vapid-keys
 */

import { FastifyInstance } from 'fastify';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '../validation';

// In-memory subscription store (production should use DB)
const subscriptions: Map<string, PushSubscriptionJSON> = new Map();

interface PushSubscriptionJSON {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
}

export default async function pushRoutes(server: FastifyInstance) {
  // ── GET /push/vapid-public-key ────────────────────────────
  server.get('/push/vapid-public-key', async (_request, reply) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return reply.status(501).send({
        error: 'Push notifications not configured',
        message: 'Set VAPID_PUBLIC_KEY environment variable',
      });
    }
    return { publicKey };
  });

  // ── POST /push/subscribe ──────────────────────────────────
  server.post('/push/subscribe', async (request, reply) => {
    const parsed = pushSubscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid subscription' });
    }
    const subscription = parsed.data;

    subscriptions.set(subscription.endpoint, subscription);
    server.log.info(`[Push] New subscription: ${subscription.endpoint.substring(0, 50)}...`);

    return { ok: true };
  });

  // ── POST /push/unsubscribe ────────────────────────────────
  server.post('/push/unsubscribe', async (request, reply) => {
    const parsed = pushUnsubscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Missing endpoint' });
    }
    const { endpoint } = parsed.data;

    subscriptions.delete(endpoint);
    return { ok: true };
  });
}

/**
 * Get all active subscriptions.
 * Used by the watcher to send notifications when new tracks are added.
 */
export function getSubscriptions(): PushSubscriptionJSON[] {
  return Array.from(subscriptions.values());
}
