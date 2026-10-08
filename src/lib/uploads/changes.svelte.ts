// Change notification for uploads. Anything that shows uploaded photos can read
// `uploadsVersion()` inside an `$effect`/`$derived` to re-run after a photo is
// added, renamed, deleted or restored. Non-Svelte code can listen to
// `uploadsEvents` for "change" events instead.

let version = $state(0);

export const uploadsEvents = new EventTarget();

/** Reactive counter that increases every time uploads change. */
export function uploadsVersion(): number {
  return version;
}

export function notifyUploadsChanged(): void {
  version++;
  uploadsEvents.dispatchEvent(new Event("change"));
}
