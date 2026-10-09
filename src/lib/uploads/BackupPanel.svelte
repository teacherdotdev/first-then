<!-- Settings rows: where photos are kept, plus download / restore of a backup .zip. -->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "#lib/components/Icon.svelte";
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

<div class="py-4">
  <div
    class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
  >
    <div>
      <h3 class="font-semibold">Saved only on this device</h3>
      <p class="text-sm text-slate-600" role="status">
        {#if statsError}
          Stored photos couldn't be counted.
        {:else if stats}
          {plural(stats.count, "photo")}{stats.count > 0
            ? ` (${formatBytes(stats.bytes)})`
            : ""}. Not uploaded or synced, so keep a backup.
        {:else}
          Counting stored photos…
        {/if}
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        class="min-h-11 rounded-full bg-accent px-4 font-semibold text-white disabled:opacity-60"
        onclick={onDownload}
        disabled={exporting}
      >
        {exporting ? "Making backup…" : "Download backup"}
      </button>
      <label
        class="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-slate-300 px-4 font-semibold text-slate-700 focus-within:outline-3 focus-within:outline-blue-700 hover:bg-slate-50 {restoring
          ? 'pointer-events-none opacity-60'
          : ''}"
      >
        {restoring ? "Restoring…" : "Restore"}
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          class="sr-only"
          onchange={onRestorePicked}
          disabled={restoring}
        />
      </label>
    </div>
  </div>

  {#if exportError}
    <p class="mt-3 text-red-700" role="alert">{exportError}</p>
  {/if}
  {#if ready}
    <div
      class="mt-3 flex flex-col gap-2 rounded-xl bg-green-50 px-4 py-3 text-green-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm">
        Backup ready ({formatBytes(ready.size)}). Didn't download?
      </p>
      <div class="flex flex-wrap gap-2">
        <a
          href={ready.url}
          download={ready.filename}
          class="inline-flex min-h-11 items-center rounded-full border border-green-600 bg-white px-4 font-semibold text-green-800"
          >Save file</a
        >
        {#if ready.file}
          <button
            type="button"
            class="min-h-11 rounded-full border border-green-600 bg-white px-4 font-semibold text-green-800"
            onclick={onShare}>Share…</button
          >
        {/if}
      </div>
    </div>
  {/if}
  {#if restoreMessage}
    <p
      class="mt-3 rounded-xl px-4 py-3 text-sm {restoreMessage.kind === 'ok'
        ? 'bg-green-50 text-green-900'
        : 'bg-red-50 text-red-800'}"
      role={restoreMessage.kind === "ok" ? "status" : "alert"}
    >
      {restoreMessage.text}
    </p>
  {/if}
</div>

<details class="group py-1">
  <summary
    class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold text-slate-700 [&::-webkit-details-marker]:hidden"
  >
    Good to know
    <Icon
      name="back"
      class="size-5 -rotate-90 transition group-open:rotate-90"
    />
  </summary>
  <ul class="list-disc space-y-1 pb-3 pl-5 text-sm text-slate-600">
    <li>
      Other devices, browsers and Home Screen apps each have their own storage.
    </li>
    <li>
      Clearing Safari's website data deletes your photos and board. Safari may
      also clear sites that haven't been opened in a while.
    </li>
    <li>
      Restoring adds the backup's photos to these, and asks before replacing the
      board, favorites and settings.
    </li>
    <li>The backup file contains your photos, so keep it private.</li>
  </ul>
</details>
