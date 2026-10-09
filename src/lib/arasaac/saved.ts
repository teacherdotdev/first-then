// Pictograms with a non-default skin or hair color, as object URLs.
//
// ARASAAC's renderer sends `Cache-Control: max-age=0`, so the browser can't show its
// pictures offline, and the deeper skin tones are painted on this device. So the
// recolored pictures in use (on the board, in recents or in favorites) are also kept
// in IndexedDB: a board then shows offline and isn't repainted on every visit. Others,
// like search results, are only kept in memory for the session.
//
// This is a cache, not data: it isn't backed up, and anything missing is made again.
// Like the photos (see `#lib/uploads/db`), pictures are stored as ArrayBuffers because
// older iOS Safari versions had bugs storing Blobs.
import type { SymbolRef } from "#lib/types.ts";
import type { PictogramLook } from "./appearance.ts";
import { recolorPictogram } from "./recolor.ts";

const DB_NAME = "first-then-pictograms";
const DB_VERSION = 1;
const STORE = "recolored";
/** Each entry is a ~40 KB PNG; generous so a long search never evicts what's shown. */
const MEMORY_SIZE = 300;

interface Stored {
  key: string;
  type: string;
  data: ArrayBuffer;
}

interface Loaded {
  blob: Blob;
  url: string;
}

function keyOf(id: number, look: PictogramLook): string {
  return `${id}:${look.skin ?? ""}:${look.hair ?? ""}`;
}

// ---- IndexedDB --------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "key" });
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
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Pictogram storage is busy."));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** Run one request; a failure drops the connection so the next call reopens it. */
async function request<T>(
  mode: IDBTransactionMode,
  make: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  try {
    const db = await openDb();
    const req = make(db.transaction(STORE, mode).objectStore(STORE));
    return await new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    dbPromise = null;
    throw err;
  }
}

// ---- In memory --------------------------------------------------------------

const memory = new Map<string, Promise<Loaded>>();

async function make(id: number, look: PictogramLook): Promise<Loaded> {
  const stored = await request<Stored | undefined>("readonly", (store) =>
    store.get(keyOf(id, look)),
  ).catch(() => undefined);
  const blob = stored
    ? new Blob([stored.data], { type: stored.type })
    : await recolorPictogram(id, look);
  return { blob, url: URL.createObjectURL(blob) };
}

function load(id: number, look: PictogramLook): Promise<Loaded> {
  const key = keyOf(id, look);
  const cached = memory.get(key);
  if (cached) {
    memory.delete(key);
    memory.set(key, cached);
    return cached;
  }

  const promise = make(id, look);
  memory.set(key, promise);
  // Let a failed picture be tried again later (e.g. after reconnecting).
  promise.catch(() => {
    if (memory.get(key) === promise) memory.delete(key);
  });

  if (memory.size > MEMORY_SIZE) {
    const [oldestKey, oldest] = memory.entries().next().value!;
    memory.delete(oldestKey);
    oldest.then(({ url }) => URL.revokeObjectURL(url)).catch(() => {});
  }
  return promise;
}

/**
 * Object URL of pictogram `id` drawn with `look` (a non-default skin or hair color).
 * Rejects if it isn't stored on this device and ARASAAC can't be reached.
 */
export async function recoloredUrl(
  id: number,
  look: PictogramLook,
): Promise<string> {
  return (await load(id, look)).url;
}

// ---- Keeping the ones in use ------------------------------------------------

type Wanted = Map<string, { id: number; look: PictogramLook }>;

/** The latest list to store, waiting for the current sync to finish. */
let wanted: Wanted | null = null;
let latest: Wanted | null = null;
let syncing = false;

function startSync(target: Wanted): void {
  wanted = target;
  if (!syncing) void drain();
}

// Pictures that couldn't be made while offline are tried again on reconnecting.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (latest) startSync(latest);
  });
}

/**
 * Store the recolored pictograms among `refs` on this device and delete stored ones
 * that aren't among them. Call with every symbol in use whenever that changes.
 * Pictures that can't be made now (offline) are tried again on the next call or
 * when the device reconnects.
 */
export function keepRecolored(refs: (SymbolRef | null)[]): void {
  const next: Wanted = new Map();
  for (const ref of refs) {
    if (ref?.kind !== "arasaac" || !(ref.skin || ref.hair)) continue;
    const look = { skin: ref.skin, hair: ref.hair };
    next.set(keyOf(ref.id, look), { id: ref.id, look });
  }
  latest = next;
  startSync(next);
}

async function drain(): Promise<void> {
  syncing = true;
  try {
    while (wanted) {
      const target = wanted;
      wanted = null;
      await sync(target).catch(() => {});
    }
  } finally {
    syncing = false;
  }
}

async function sync(target: Wanted): Promise<void> {
  const stored = new Set(
    (await request("readonly", (store) => store.getAllKeys())).map(String),
  );
  for (const key of stored) {
    if (!target.has(key)) await request("readwrite", (s) => s.delete(key));
  }
  for (const [key, { id, look }] of target) {
    // A newer list arrived: `drain` starts over with it.
    if (wanted) return;
    if (stored.has(key)) continue;
    try {
      const { blob } = await load(id, look);
      const entry: Stored = {
        key,
        type: blob.type || "image/png",
        data: await blob.arrayBuffer(),
      };
      await request("readwrite", (s) => s.put(entry));
    } catch {
      // Offline or storage full: try again next time.
    }
  }
}
