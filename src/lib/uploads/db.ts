// Uploaded images live only in this browser's IndexedDB; nothing is sent to a server.
//
// Records are stored as { id, name, createdAt, type, data: ArrayBuffer } rather than
// as Blobs: older iOS Safari versions had bugs storing Blobs in IndexedDB, while
// ArrayBuffers have always worked. Callers still get `UploadRecord` with a Blob.
import type { UploadRecord } from "#lib/types.ts";
import { notifyUploadsChanged } from "./changes.svelte.ts";
import { resizeImage } from "./resize.ts";

export { uploadsEvents, uploadsVersion } from "./changes.svelte.ts";

const DB_NAME = "first-then-uploads";
const DB_VERSION = 1;
const STORE = "uploads";

interface StoredUpload {
  id: string;
  name: string;
  createdAt: number;
  type: string;
  data: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "This browser can't store photos (IndexedDB is unavailable).",
        ),
      );
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // iOS can drop the connection while the app is in the background; reopen next time.
      db.onclose = () => {
        dbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () =>
      reject(req.error ?? new Error("Could not open photo storage."));
    req.onblocked = () =>
      reject(new Error("Photo storage is busy. Close other tabs of this app."));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Run `fn` in a transaction and resolve once the transaction has committed.
 * Retries once with a fresh connection, because iOS Safari sometimes reports
 * "Connection to Indexed Database server lost" after the app was backgrounded.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const attempt = async () => {
    const db = await openDb();
    const tx = db.transaction(STORE, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error("Photo storage transaction aborted."));
    });
    // Avoid an "unhandled rejection" if `fn` throws first; `done` is awaited below.
    done.catch(() => {});
    const result = await fn(tx.objectStore(STORE));
    await done;
    return result;
  };
  try {
    return await attempt();
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new Error("This device is out of storage space for photos.", {
        cause: err,
      });
    }
    dbPromise = null;
    return attempt();
  }
}

function toRecord(stored: StoredUpload): UploadRecord {
  return {
    id: stored.id,
    name: stored.name,
    createdAt: stored.createdAt,
    blob: new Blob([stored.data], { type: stored.type || "image/jpeg" }),
  };
}

/** New random id; `crypto.randomUUID` needs iOS 15.4+, so fall back on older devices. */
export function newUploadId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Ask the browser not to evict our storage when space is low (best effort). */
function requestPersistence() {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // Not supported (older Safari): nothing to do.
  }
}

// ---- Object URL cache -------------------------------------------------------

const urlCache = new Map<string, string>();

function forgetUrl(id: string) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

/** Cached object URL for a record already in memory (e.g. from `listUploads`). */
export function objectUrlForRecord(record: UploadRecord): string {
  let url = urlCache.get(record.id);
  if (!url) {
    url = URL.createObjectURL(record.blob);
    urlCache.set(record.id, url);
  }
  return url;
}

// ---- Public API -------------------------------------------------------------

/** All uploads on this device, newest first. */
export async function listUploads(): Promise<UploadRecord[]> {
  const stored = await withStore("readonly", (store) =>
    promisify(store.getAll() as IDBRequest<StoredUpload[]>),
  );
  return stored.map(toRecord).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getUpload(id: string): Promise<UploadRecord | null> {
  const stored = await withStore("readonly", (store) =>
    promisify(store.get(id) as IDBRequest<StoredUpload | undefined>),
  );
  return stored ? toRecord(stored) : null;
}

/** Object URL for an upload's image, or null if it no longer exists on this device. */
export async function uploadObjectUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const record = await getUpload(id);
  if (!record) return null;
  // Another call may have filled the cache while we were reading.
  return objectUrlForRecord(record);
}

/** Save (insert or overwrite by id) an already-resized upload. */
export async function putUpload(record: UploadRecord): Promise<void> {
  const data = await record.blob.arrayBuffer();
  const stored: StoredUpload = {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    type: record.blob.type || "image/jpeg",
    data,
  };
  await withStore("readwrite", (store) => promisify(store.put(stored)));
  forgetUrl(record.id);
  requestPersistence();
  notifyUploadsChanged();
}

/** Save several uploads in one go (used by restore). Notifies once. */
export async function putUploads(records: UploadRecord[]): Promise<void> {
  const stored: StoredUpload[] = [];
  for (const record of records) {
    stored.push({
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      type: record.blob.type || "image/jpeg",
      data: await record.blob.arrayBuffer(),
    });
  }
  await withStore("readwrite", async (store) => {
    for (const s of stored) store.put(s);
  });
  for (const r of records) forgetUrl(r.id);
  requestPersistence();
  notifyUploadsChanged();
}

/** Resize a picked image file and save it. Throws ImageDecodeError for unreadable pictures. */
export async function addUpload(
  file: Blob,
  name: string,
): Promise<UploadRecord> {
  const blob = await resizeImage(file);
  const record: UploadRecord = {
    id: newUploadId(),
    name: name.trim() || "Photo",
    blob,
    createdAt: Date.now(),
  };
  await putUpload(record);
  return record;
}

export async function renameUpload(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await withStore("readwrite", async (store) => {
    const existing = await promisify(
      store.get(id) as IDBRequest<StoredUpload | undefined>,
    );
    if (existing) await promisify(store.put({ ...existing, name: trimmed }));
  });
  notifyUploadsChanged();
}

export async function deleteUpload(id: string): Promise<void> {
  await withStore("readwrite", (store) => promisify(store.delete(id)));
  forgetUrl(id);
  notifyUploadsChanged();
}

/** Number of photos and their total size in bytes. */
export async function uploadStats(): Promise<{ count: number; bytes: number }> {
  const stored = await withStore("readonly", (store) =>
    promisify(store.getAll() as IDBRequest<StoredUpload[]>),
  );
  return {
    count: stored.length,
    bytes: stored.reduce((sum, s) => sum + s.data.byteLength, 0),
  };
}
