// OWNER: uploads agent. Stub — signatures are the contract used by the core app.
// Uploaded images live only in this browser's IndexedDB; nothing is sent to a server.
import type { UploadRecord } from "#lib/types.ts";

export async function listUploads(): Promise<UploadRecord[]> {
  return [];
}

/** Object URL for an upload's image, or null if it no longer exists on this device. */
export async function uploadObjectUrl(id: string): Promise<string | null> {
  void id;
  return null;
}
