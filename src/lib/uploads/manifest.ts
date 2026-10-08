// Pure backup-file format logic: building and reading the backup .zip.
// No IndexedDB, localStorage or DOM here, so it can be tested on its own.
//
// Backup .zip layout (format version 1):
//   manifest.json            BackupManifest (see below)
//   images/<id>.<ext>        one file per uploaded photo (JPEG or PNG)
//
// ARASAAC symbols are stored as ids only inside the board/recents/favorites JSON;
// they re-load from ARASAAC after a restore.
import { unzipSync, zipSync, type Zippable } from "fflate";
import { STORAGE_KEYS } from "#lib/types.ts";

export const BACKUP_FORMAT = "first-then-backup";
export const BACKUP_VERSION = 1;
export const MANIFEST_NAME = "manifest.json";

/** Short, stable names for the localStorage entries saved in a backup. */
export type StateName = keyof typeof STORAGE_KEYS;
export const STATE_NAMES = Object.keys(STORAGE_KEYS) as StateName[];

export interface BackupUploadEntry {
  id: string;
  name: string;
  createdAt: number;
  /** Path of the image inside the zip, e.g. `images/<id>.jpg`. */
  filename: string;
  /** MIME type of the image, e.g. `image/jpeg`. */
  type: string;
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO timestamp of when the backup was made. */
  exportedAt: string;
  /** Parsed JSON of each localStorage entry; a missing name means "was empty". */
  state: Partial<Record<StateName, unknown>>;
  uploads: BackupUploadEntry[];
}

/** An upload as it goes into / comes out of a backup (bytes instead of a Blob). */
export interface BackupUpload {
  id: string;
  name: string;
  createdAt: number;
  type: string;
  data: Uint8Array;
}

export interface ParsedBackup {
  manifest: BackupManifest;
  uploads: BackupUpload[];
}

/** Error whose message is safe and friendly to show to the teacher. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Largest single file we are willing to unpack from a backup (guards against bad zips). */
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_UPLOADS = 5000;

export function extensionForType(type: string): string {
  return ALLOWED_TYPES[type] ?? "jpg";
}

/** `first-then-backup-YYYY-MM-DD.zip`, using the device's local date. */
export function backupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `first-then-backup-${day}.zip`;
}

/**
 * Turn raw localStorage strings into the manifest's `state` object.
 * Entries that are missing or not valid JSON are left out.
 */
export function stateFromStorage(
  raw: Partial<Record<StateName, string | null>>,
): BackupManifest["state"] {
  const state: BackupManifest["state"] = {};
  for (const name of STATE_NAMES) {
    const value = raw[name];
    if (value == null) continue;
    try {
      state[name] = JSON.parse(value);
    } catch {
      // Corrupt entry: nothing worth backing up.
    }
  }
  return state;
}

function safeIdForPath(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  return cleaned || "photo";
}

export function buildManifest(
  state: BackupManifest["state"],
  uploads: Omit<BackupUpload, "data">[],
  now: Date = new Date(),
): BackupManifest {
  const used = new Set<string>();
  const entries = uploads.map((u) => {
    const base = `images/${safeIdForPath(u.id)}`;
    const ext = extensionForType(u.type);
    let filename = `${base}.${ext}`;
    for (let n = 2; used.has(filename); n++) filename = `${base}-${n}.${ext}`;
    used.add(filename);
    return {
      id: u.id,
      name: u.name,
      createdAt: u.createdAt,
      filename,
      type: u.type,
    };
  });
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    state,
    uploads: entries,
  };
}

/** Build the complete backup .zip bytes. */
export function buildBackupZip(
  state: BackupManifest["state"],
  uploads: BackupUpload[],
  now: Date = new Date(),
): Uint8Array {
  const manifest = buildManifest(state, uploads, now);
  const files: Zippable = {
    [MANIFEST_NAME]: [
      new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
      { level: 6 },
    ],
  };
  manifest.uploads.forEach((entry, i) => {
    // Photos are already compressed; storing them avoids wasted work.
    files[entry.filename] = [uploads[i].data, { level: 0 }];
  });
  return zipSync(files, { mtime: now });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate an already-parsed manifest object. Throws BackupError. */
export function parseManifest(json: unknown): BackupManifest {
  if (!isRecord(json) || json.format !== BACKUP_FORMAT) {
    throw new BackupError(
      "This file is not a First / Then backup. Choose a file named like first-then-backup-….zip.",
    );
  }
  if (typeof json.version !== "number" || json.version > BACKUP_VERSION) {
    throw new BackupError(
      "This backup was made by a newer version of the app. Reload the page to update the app, then try again.",
    );
  }

  const state: BackupManifest["state"] = {};
  if (isRecord(json.state)) {
    for (const name of STATE_NAMES) {
      if (name in json.state && json.state[name] !== undefined) {
        state[name] = json.state[name];
      }
    }
  }

  if (!Array.isArray(json.uploads)) {
    throw new BackupError(
      "This backup file is damaged (its photo list is missing).",
    );
  }
  if (json.uploads.length > MAX_UPLOADS) {
    throw new BackupError("This backup file has too many photos to restore.");
  }

  const uploads: BackupUploadEntry[] = [];
  const seenIds = new Set<string>();
  for (const raw of json.uploads) {
    if (!isRecord(raw)) continue;
    const { id, name, createdAt, filename, type } = raw;
    if (typeof id !== "string" || id.length === 0 || id.length > 200) continue;
    if (seenIds.has(id)) continue;
    if (
      typeof filename !== "string" ||
      !/^images\/[A-Za-z0-9_.-]+$/.test(filename)
    ) {
      continue;
    }
    if (typeof type !== "string" || !(type in ALLOWED_TYPES)) continue;
    seenIds.add(id);
    uploads.push({
      id,
      name:
        typeof name === "string" && name.trim()
          ? name.trim().slice(0, 200)
          : "Photo",
      createdAt:
        typeof createdAt === "number" && Number.isFinite(createdAt)
          ? createdAt
          : Date.now(),
      filename,
      type,
    });
  }

  return {
    format: BACKUP_FORMAT,
    version: json.version,
    exportedAt: typeof json.exportedAt === "string" ? json.exportedAt : "",
    state,
    uploads,
  };
}

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Read and validate backup .zip bytes. Photos listed in the manifest but missing
 * from the zip are skipped (reported via `missing`).
 */
export function readBackupZip(
  bytes: Uint8Array,
): ParsedBackup & { missing: number } {
  if (!looksLikeZip(bytes)) {
    throw new BackupError(
      "This file is not a .zip backup. Choose the first-then-backup-….zip file you saved.",
    );
  }

  let manifestBytes: Uint8Array | undefined;
  try {
    manifestBytes = unzipSync(bytes, {
      filter: (f) =>
        f.name === MANIFEST_NAME && f.originalSize <= MAX_ENTRY_BYTES,
    })[MANIFEST_NAME];
  } catch {
    throw new BackupError("This backup file is damaged and can't be opened.");
  }
  if (!manifestBytes) {
    throw new BackupError(
      "This .zip is not a First / Then backup (manifest.json is missing).",
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    throw new BackupError(
      "This backup file is damaged (manifest.json can't be read).",
    );
  }
  const manifest = parseManifest(json);

  const wanted = new Set(manifest.uploads.map((u) => u.filename));
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => wanted.has(f.name) && f.originalSize <= MAX_ENTRY_BYTES,
    });
  } catch {
    throw new BackupError(
      "Some photos in this backup file are damaged and can't be opened.",
    );
  }

  const uploads: BackupUpload[] = [];
  let missing = 0;
  for (const entry of manifest.uploads) {
    const data = files[entry.filename];
    if (!data || data.length === 0) {
      missing++;
      continue;
    }
    uploads.push({
      id: entry.id,
      name: entry.name,
      createdAt: entry.createdAt,
      type: entry.type,
      data,
    });
  }
  return { manifest, uploads, missing };
}
