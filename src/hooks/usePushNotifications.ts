/**
 * usePushNotifications.ts
 * ─────────────────────────────────────────────────────────────
 * Web Push Notifications for new release alerts.
 *
 * When a new album is scanned into the vault, the server can send
 * a push notification to all subscribed devices. The iPhone shows
 * the notification on the lock screen.
 *
 * Requirements:
 *   • iOS 16.4+ with the app installed as a PWA ("Add to Home Screen")
 *   • VAPID keys configured on the server
 *   • User grants notification permission
 */

import { useState, useEffect, useCallback } from 'react';

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported =
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    setSupported(isSupported);

    if (isSupported) {
      setPermission(Notification.permission);
      // Check if already subscribed
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return false;

    // Request permission
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return false;

    try {
      // Fetch the VAPID public key from the server
      const res = await fetch(`${BASE_URL}/api/push/vapid-public-key`);
      if (!res.ok) return false;

      const { publicKey } = (await res.json()) as { publicKey: string };

      // Convert base64url VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Subscribe via PushManager
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Send subscription to server
      await fetch(`${BASE_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      console.warn('[Push] Subscription failed:', err);
      return false;
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        // Notify server
        await fetch(`${BASE_URL}/api/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.warn('[Push] Unsubscribe failed:', err);
    }
  }, []);

  return { supported, permission, subscribed, subscribe, unsubscribe };
}

/**
 * Convert a base64url-encoded string to a Uint8Array.
 * Required for PushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
