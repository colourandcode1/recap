// IndexedDB thin wrapper — one object store, indexes by sessionId/timestamp/type.

import type { AnyEvent } from '../types.js';

const DB_NAME = 'recap-sessions';
const DB_VERSION = 2;
const STORE_NAME = 'events';
const RETENTION_DAYS = 30;

let _db: IDBDatabase | null = null;
let _unavailable = false;
// In-memory fallback when IndexedDB is unavailable
const _memoryStore: AnyEvent[] = [];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const openReq = e.target as IDBOpenDBRequest;
      const db = openReq.result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      } else {
        // v1 → v2 migration: access existing store via the version-change transaction
        store = openReq.transaction!.objectStore(STORE_NAME);
      }
      // v2: wallTime index (epoch ms) for retention purge.
      // v1 events lack wallTime — they are absent from this index and thus exempt from purge.
      if (!store.indexNames.contains('wallTime')) {
        store.createIndex('wallTime', 'wallTime', { unique: false });
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function getDB(): Promise<IDBDatabase | null> {
  if (_unavailable) return null;
  if (_db) return _db;
  try {
    _db = await openDB();
    return _db;
  } catch {
    _unavailable = true;
    console.warn('[Recap] IndexedDB unavailable — events stored in memory only');
    return null;
  }
}

export async function saveEvents(events: AnyEvent[]): Promise<void> {
  if (events.length === 0) return;

  const db = await getDB();
  if (!db) {
    _memoryStore.push(...events);
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    events.forEach((e) => store.add(e));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSessionEvents(sessionId: string): Promise<AnyEvent[]> {
  const db = await getDB();
  if (!db) {
    return _memoryStore.filter((e) => e.sessionId === sessionId);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('sessionId');
    const req = index.getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => resolve(req.result as AnyEvent[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSessions(): Promise<
  Array<{ sessionId: string; sessionName?: string; startTime: number; eventCount: number }>
> {
  const db = await getDB();
  if (!db) {
    const ids = [...new Set(_memoryStore.map((e) => e.sessionId))];
    return ids.map((id) => {
      const events = _memoryStore.filter((e) => e.sessionId === id);
      return {
        sessionId: id,
        startTime: Math.min(...events.map((e) => e.timestamp)),
        eventCount: events.length,
      };
    });
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = req.result as AnyEvent[];
      const sessionMap = new Map<
        string,
        { sessionId: string; startTime: number; eventCount: number }
      >();
      for (const e of all) {
        const existing = sessionMap.get(e.sessionId);
        if (!existing) {
          sessionMap.set(e.sessionId, {
            sessionId: e.sessionId,
            startTime: e.timestamp,
            eventCount: 1,
          });
        } else {
          existing.eventCount++;
          if (e.timestamp < existing.startTime) existing.startTime = e.timestamp;
        }
      }
      resolve(Array.from(sessionMap.values()));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearSession(sessionId: string): Promise<void> {
  const db = await getDB();
  if (!db) {
    const toRemove = new Set(_memoryStore.filter((e) => e.sessionId === sessionId));
    for (let i = _memoryStore.length - 1; i >= 0; i--) {
      if (toRemove.has(_memoryStore[i]!)) _memoryStore.splice(i, 1);
    }
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const index = tx.objectStore(STORE_NAME).index('sessionId');
    const req = index.openCursor(IDBKeyRange.only(sessionId));
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllSessions(): Promise<void> {
  const db = await getDB();
  if (!db) {
    _memoryStore.length = 0;
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove sessions older than RETENTION_DAYS. Called on init. */
export async function purgeOldSessions(): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    // Purge on wallTime (epoch ms), NOT timestamp: timestamps are performance.now()
    // values (~ms since page load), so comparing them against an epoch cutoff
    // matched every event and wiped all sessions on each init.
    // Events without wallTime are not in this index → never purged here.
    const index = tx.objectStore(STORE_NAME).index('wallTime');
    const req = index.openCursor(IDBKeyRange.upperBound(cutoff));
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function isUsingMemoryFallback(): boolean {
  return _unavailable;
}
