/**
 * offlineQueue.ts
 * ─────────────────────────────────────────────────────────────
 * Offline action queue using IndexedDB.
 *
 * When the app is offline (e.g. in the metro), user actions like
 * "like a track" or "add to playlist" are stored in an IndexedDB
 * queue. When connectivity returns, the Background Sync API or a
 * manual flush sends them to the server.
 *
 * Actions are stored as serialized fetch requests so the service
 * worker can replay them exactly.
 */

const DB_NAME = 'vault-offline-queue';
const STORE_NAME = 'actions';
const DB_VERSION = 1;

export interface OfflineAction {
  id?: number;
  url: string;
  method: string;
  body?: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue an action for later sync.
 * Also requests a Background Sync if the API is available.
 */
export async function queueAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.add({ ...action, timestamp: Date.now() });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  // Request Background Sync if supported
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    try {
      await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('vault-sync');
    } catch {
      // Background Sync not available — will flush manually
    }
  }
}

/**
 * Get all queued actions.
 */
export async function getQueuedActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      db.close();
      resolve(request.result as OfflineAction[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove a successfully synced action from the queue.
 */
export async function removeAction(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Flush: replay all queued actions against the server.
 * Called either by the service worker (Background Sync) or
 * manually when connectivity returns.
 */
export async function flushQueue(): Promise<void> {
  const actions = await getQueuedActions();

  for (const action of actions) {
    try {
      const init: RequestInit = {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (action.body) init.body = action.body;

      const response = await fetch(action.url, init);
      if (response.ok || response.status === 409) {
        // Success or conflict (already exists) — remove from queue
        if (action.id !== undefined) {
          await removeAction(action.id);
        }
      }
    } catch {
      // Still offline — stop flushing, will retry later
      break;
    }
  }
}
