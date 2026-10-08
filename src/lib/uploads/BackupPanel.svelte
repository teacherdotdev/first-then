<!-- Settings section: privacy explanation + download / restore of a backup .zip. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { uploadStats, uploadsVersion } from "./db.ts";
  import {
    BackupError,
    applyBackup,
    backupFilename,
    downloadBlob,
    exportBackup,
    formatBytes,
    hasState,
    readBackupFile,
    setRestoredFlash,
    shareableFile,
    takeRestoredFlash,
  } from "./backup.ts";

  let stats = $state<{ count: number; bytes: number } | null>(null);
  let statsError = $state(false);

  let exporting = $state(false);
  let exportError = $state<string | null>(null);
  let ready = $state<{
    url: string;
    filename: string;
    size: number;
    file: File | null;
  } | null>(null);

  let restoring = $state(false);
  let restoreMessage = $state<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  $effect(() => {
    uploadsVersion();
    let cancelled = false;
    uploadStats()
      .then((s) => {
        if (!cancelled) stats = s;
      })
      .catch(() => {
        if (!cancelled) statsError = true;
      });
    return () => {
      cancelled = true;
    };
  });

  onMount(() => {
    const flash = takeRestoredFlash();
    if (flash) restoreMessage = { kind: "ok", text: flash };
    return () => {
      if (ready) URL.revokeObjectURL(ready.url);
    };
  });

  function plural(n: number, word: string) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  async function onDownload() {
    if (exporting) return;
    exporting = true;
    exportError = null;
    if (ready) {
      URL.revokeObjectURL(ready.url);
      ready = null;
    }
    try {
      const blob = await exportBackup();
      const filename = backupFilename();
      ready = {
        url: URL.createObjectURL(blob),
        filename,
        size: blob.size,
        file: shareableFile(blob, filename),
      };
      downloadBlob(blob, filename);
    } catch {
      exportError = "The backup couldn't be made. Please try again.";
    } finally {
      exporting = false;
    }
  }

  async function onShare() {
    if (!ready?.file) return;
    try {
      await navigator.share({ files: [ready.file], title: ready.filename });
    } catch {
      // Cancelled by the teacher, or sharing failed: the download link is still there.
    }
  }

  async function onRestorePicked(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || restoring) return;

    restoring = true;
    restoreMessage = null;
    try {
      const backup = await readBackupFile(file);
      const replaceState =
        hasState(backup.manifest) &&
        confirm(
          "Replace current board, favorites and settings with the backup?\n\n" +
            "OK = replace them.\nCancel = keep them (photos from the backup are still added).",
        );
      const result = await applyBackup(backup, replaceState);

      let text = `Restored ${plural(result.photos, "photo")}`;
      text += result.replacedState
        ? " and the board, favorites and settings from the backup."
        : ". Your current board, favorites and settings were kept.";
      if (backup.missing > 0) {
        text += ` ${plural(backup.missing, "photo")} in the backup could not be read and ${backup.missing === 1 ? "was" : "were"} skipped.`;
      }
      setRestoredFlash(text);
      location.reload();
    } catch (err) {
      restoreMessage = {
        kind: "error",
        text:
          err instanceof BackupError
            ? err.message
            : "The backup couldn't be restored. Nothing was changed. Please try again.",
      };
      restoring = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <div
    class="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-slate-800"
  >
    <p>
      <strong>Everything stays on this device.</strong> Your photos, board,
      favorites and settings are saved only in this browser on this iPad/device.
      They are never uploaded to any server and are <strong>not</strong> synced to
      your other devices or to iCloud.
    </p>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li>
        A new iPad, a different browser, or this app added to the Home Screen
        each keep
        <strong>their own separate</strong> storage — they can't see what's saved
        here.
      </li>
      <li>
        Clearing Safari's history or website data deletes your photos and board.
        Safari may also clear website data for sites that haven't been opened in
        a while, so keep a recent backup.
      </li>
      <li>
        To move to a new device (without re-adding every photo), download a
        backup here, then open this app on the new device and choose <em
          >Restore from backup</em
        >.
      </li>
      <li>
        The backup file contains your photos. Keep it somewhere private, such as
        <em>On My iPad</em> in the Files app.
      </li>
    </ul>
  </div>

  <p class="text-slate-700" role="status">
    {#if statsError}
      Stored photos couldn't be counted.
    {:else if stats}
      {plural(stats.count, "photo")} stored on this device{stats.count > 0
        ? ` (about ${formatBytes(stats.bytes)})`
        : ""}.
    {:else}
      Counting stored photos…
    {/if}
  </p>

  <div class="flex flex-col gap-2">
    <button
      type="button"
      class="min-h-12 rounded-xl bg-blue-600 px-5 py-3 text-lg font-semibold text-white disabled:opacity-60"
      onclick={onDownload}
      disabled={exporting}
    >
      {exporting ? "Making backup…" : "Download backup (.zip)"}
    </button>
    <p class="text-sm text-slate-600">
      Saves one file with all photos, the board, favorites and settings. On iPad
      it goes to
      <em>Files › Downloads</em>.
    </p>
    {#if exportError}
      <p class="text-red-700" role="alert">{exportError}</p>
    {/if}
    {#if ready}
      <div
        class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-900"
      >
        <p>Backup ready: {ready.filename} ({formatBytes(ready.size)}).</p>
        <p class="mt-1 text-sm">If nothing was saved, use one of these:</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <a
            href={ready.url}
            download={ready.filename}
            class="inline-flex min-h-11 items-center rounded-lg border border-green-600 bg-white px-4 font-semibold text-green-800"
            >Save backup file</a
          >
          {#if ready.file}
            <button
              type="button"
              class="min-h-11 rounded-lg border border-green-600 bg-white px-4 font-semibold text-green-800"
              onclick={onShare}>Share / Save to Files…</button
            >
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="flex flex-col gap-2">
    <label
      class="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-blue-600 bg-white px-5 py-3 text-lg font-semibold text-blue-700 focus-within:ring-4 focus-within:ring-blue-300 {restoring
        ? 'pointer-events-none opacity-60'
        : ''}"
    >
      {restoring ? "Restoring…" : "Restore from backup"}
      <input
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        class="sr-only"
        onchange={onRestorePicked}
        disabled={restoring}
      />
    </label>
    <p class="text-sm text-slate-600">
      Choose a <em>first-then-backup-….zip</em> file. Photos in the backup are added
      to the ones already here (nothing is deleted). You'll be asked before the board,
      favorites and settings are replaced.
    </p>
    {#if restoreMessage}
      <p
        class={restoreMessage.kind === "ok"
          ? "rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-900"
          : "rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800"}
        role={restoreMessage.kind === "ok" ? "status" : "alert"}
      >
        {restoreMessage.text}
      </p>
    {/if}
  </div>
</div>
