// Backup / restore of everything on this device: uploaded photos (IndexedDB) and the
// small JSON state in localStorage (board, settings, recents, favorites).
// All work happens in the browser; the .zip is only ever saved where the teacher chooses.
import { STORAGE_KEYS, type UploadRecord } from "#lib/types.ts";
import { listUploads, putUploads } from "./db.ts";
import {
  BackupError,
  STATE_NAMES,
  backupFilename,
  buildBackupZip,
  readBackupZip,
  stateFromStorage,
  type BackupManifest,
  type BackupUpload,
  type ParsedBackup,
  type StateName,
} from "./manifest.ts";

export { BackupError, backupFilename };

const RESTORED_FLASH_KEY = "first-then:backup-restored";

function readStorage(): Partial<Record<StateName, string | null>> {
  const raw: Partial<Record<StateName, string | null>> = {};
  for (const name of STATE_NAMES) {
    try {
      raw[name] = localStorage.getItem(STORAGE_KEYS[name]);
    } catch {
      raw[name] = null;
    }
  }
  return raw;
}

/** Build the backup .zip for everything stored on this device. */
export async function exportBackup(): Promise<Blob> {
  const records = await listUploads();
  const uploads: BackupUpload[] = [];
  for (const r of records) {
    uploads.push({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      type: r.blob.type || "image/jpeg",
      data: new Uint8Array(await r.blob.arrayBuffer()),
    });
  }
  const bytes = buildBackupZip(stateFromStorage(readStorage()), uploads);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}

export interface ReadBackupResult extends ParsedBackup {
  /** Photos listed in the manifest whose image file was missing from the zip. */
  missing: number;
}

/** Read and validate a picked backup file without changing anything. Throws BackupError. */
export async function readBackupFile(file: Blob): Promise<ReadBackupResult> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new BackupError(
      "The backup file couldn't be read. Try choosing it again.",
    );
  }
  return readBackupZip(bytes);
}

/** True if the backup has any board/settings/recents/favorites data to restore. */
export function hasState(manifest: BackupManifest): boolean {
  return STATE_NAMES.some((name) => name in manifest.state);
}

/**
 * Apply a validated backup. Photos are always merged (same id overwrites, so board
 * references keep working). If `replaceState`, the board, settings, recents and
 * favorites are replaced by the backup's (entries absent from the backup are cleared).
 */
export async function applyBackup(
  backup: ParsedBackup,
  replaceState: boolean,
): Promise<{ photos: number; replacedState: boolean }> {
  const records: UploadRecord[] = backup.uploads.map((u) => ({
    id: u.id,
    name: u.name,
    createdAt: u.createdAt,
    blob: new Blob([u.data as Uint8Array<ArrayBuffer>], { type: u.type }),
  }));
  if (records.length > 0) await putUploads(records);

  if (replaceState) {
    try {
      for (const name of STATE_NAMES) {
        const key = STORAGE_KEYS[name];
        if (name in backup.manifest.state) {
          localStorage.setItem(
            key,
            JSON.stringify(backup.manifest.state[name]),
          );
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch {
      throw new BackupError(
        `The ${records.length} photo(s) were restored, but the board and settings couldn't be saved on this device.`,
      );
    }
  }
  return { photos: records.length, replacedState: replaceState };
}

/** Convenience: read + apply in one call. */
export async function importBackup(
  file: Blob,
  replaceState: boolean,
): Promise<{ photos: number; replacedState: boolean; missing: number }> {
  const parsed = await readBackupFile(file);
  const result = await applyBackup(parsed, replaceState);
  return { ...result, missing: parsed.missing };
}

/** Remember a success message across the `location.reload()` that follows a restore. */
export function setRestoredFlash(message: string): void {
  try {
    sessionStorage.setItem(RESTORED_FLASH_KEY, message);
  } catch {
    // Private mode etc.: the message just won't show after reload.
  }
}

export function takeRestoredFlash(): string | null {
  try {
    const message = sessionStorage.getItem(RESTORED_FLASH_KEY);
    if (message) sessionStorage.removeItem(RESTORED_FLASH_KEY);
    return message;
  } catch {
    return null;
  }
}

/** Save a Blob as a file via a temporary `<a download>` link (works on iOS 13+ Safari). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download on iOS; give it time.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A File for the share sheet, if this browser can share files (iOS 15 Safari can). */
export function shareableFile(blob: Blob, filename: string): File | null {
  try {
    const file = new File([blob], filename, { type: "application/zip" });
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      return file;
    }
  } catch {
    // File constructor or canShare unsupported.
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
