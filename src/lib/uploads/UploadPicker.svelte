<!-- "My photos" tab of the symbol picker: add, name, rename and delete the teacher's own
     pictures (stored only on this device). Tapping a photo calls onselect. -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { SymbolRef, UploadRecord } from "#lib/types.ts";
  import {
    deleteUpload,
    listUploads,
    newUploadId,
    objectUrlForRecord,
    putUpload,
    renameUpload,
    uploadsVersion,
  } from "./db.ts";
  import { ImageDecodeError, nameFromFilename, resizeImage } from "./resize.ts";

  let { onselect }: { onselect: (ref: SymbolRef) => void } = $props();

  interface Pending {
    key: string;
    blob: Blob;
    previewUrl: string;
    name: string;
  }

  let uploads = $state<UploadRecord[]>([]);
  let loaded = $state(false);
  let loadError = $state<string | null>(null);

  let preparing = $state(0);
  let pending = $state<Pending[]>([]);
  let failures = $state<string[]>([]);
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  let renamingId = $state<string | null>(null);
  let renameValue = $state("");

  $effect(() => {
    uploadsVersion();
    let cancelled = false;
    listUploads()
      .then((list) => {
        if (cancelled) return;
        uploads = list;
        loadError = null;
        loaded = true;
      })
      .catch(() => {
        if (cancelled) return;
        loadError =
          "Your photos couldn't be loaded. Reload the page and try again. (In Private Browsing, photos can't be saved.)";
        loaded = true;
      });
    return () => {
      cancelled = true;
    };
  });

  async function onFilesPicked(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Reset so picking the same photo again still fires a change event.
    input.value = "";
    if (files.length === 0) return;

    saveError = null;
    preparing += files.length;
    for (const file of files) {
      try {
        const blob = await resizeImage(file);
        pending.push({
          key: newUploadId(),
          blob,
          previewUrl: URL.createObjectURL(blob),
          name: nameFromFilename(file.name),
        });
      } catch (err) {
        failures.push(
          err instanceof ImageDecodeError
            ? err.message
            : `"${file.name}" couldn't be added. Please try again.`,
        );
      } finally {
        preparing -= 1;
      }
    }
  }

  function removePending(key: string) {
    const item = pending.find((p) => p.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    pending = pending.filter((p) => p.key !== key);
  }

  function clearPending() {
    for (const p of pending) URL.revokeObjectURL(p.previewUrl);
    pending = [];
  }

  async function savePending(event: SubmitEvent) {
    event.preventDefault();
    if (saving || pending.length === 0) return;
    saving = true;
    saveError = null;
    try {
      // Save oldest-picked first so the newest-first list keeps the picked order at top.
      const now = Date.now();
      const items = [...pending];
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        await putUpload({
          id: p.key,
          name: p.name.trim() || "Photo",
          blob: p.blob,
          createdAt: now + (items.length - i),
        });
        removePending(p.key);
      }
      failures = [];
    } catch (err) {
      saveError =
        err instanceof Error && /storage space/.test(err.message)
          ? err.message
          : "The photos couldn't be saved on this device. Please try again.";
    } finally {
      saving = false;
    }
  }

  function startRename(record: UploadRecord) {
    renamingId = record.id;
    renameValue = record.name;
  }

  async function submitRename(event: SubmitEvent) {
    event.preventDefault();
    const id = renamingId;
    if (!id) return;
    const value = renameValue.trim();
    renamingId = null;
    if (value) await renameUpload(id, value).catch(() => {});
  }

  async function confirmDelete(record: UploadRecord) {
    const ok = confirm(
      `Delete the photo "${record.name}" from this device?\n\nBoards that use it will show "Photo not on this device". This can't be undone unless you have a backup.`,
    );
    if (!ok) return;
    await deleteUpload(record.id).catch(() => {
      alert("The photo couldn't be deleted. Please try again.");
    });
  }

  function selectFocus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  onDestroy(clearPending);
</script>

<div class="flex flex-col gap-4">
  <p
    class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
    role="note"
  >
    <strong>Private:</strong> Photos are saved only on this iPad/device. They
    are never uploaded. Use
    <strong>Backup</strong> in Settings to move them to another device.
  </p>

  <label
    class="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-lg font-semibold text-white shadow-sm focus-within:ring-4 focus-within:ring-blue-300 active:bg-blue-700"
  >
    <span aria-hidden="true" class="text-2xl leading-none">+</span>
    Add photo
    <input
      type="file"
      accept="image/*"
      multiple
      class="sr-only"
      onchange={onFilesPicked}
    />
  </label>

  {#if preparing > 0}
    <p class="text-center text-slate-600" role="status">
      Preparing {preparing === 1 ? "photo" : `${preparing} photos`}…
    </p>
  {/if}

  {#if failures.length > 0}
    <div
      class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      role="alert"
    >
      <ul class="list-disc pl-5">
        {#each failures as failure, i (i)}
          <li>{failure}</li>
        {/each}
      </ul>
      <button
        type="button"
        class="mt-1 min-h-11 underline"
        onclick={() => (failures = [])}>OK</button
      >
    </div>
  {/if}

  {#if pending.length > 0}
    <form
      class="flex flex-col gap-3 rounded-xl border-2 border-blue-200 bg-white p-3"
      onsubmit={savePending}
    >
      <h3 class="text-lg font-semibold text-slate-800">
        Name {pending.length === 1 ? "this photo" : "these photos"}
      </h3>
      <ul class="flex flex-col gap-3">
        {#each pending as item, i (item.key)}
          <li class="flex items-center gap-3">
            <img
              src={item.previewUrl}
              alt=""
              class="size-20 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
            />
            <label
              class="flex min-w-0 grow flex-col gap-1 text-sm text-slate-600"
            >
              Name shown under the picture
              {#if i === 0}
                <input
                  type="text"
                  bind:value={item.name}
                  maxlength="60"
                  autocomplete="off"
                  class="min-h-11 rounded-lg border border-slate-300 px-3 text-lg text-slate-900"
                  use:selectFocus
                />
              {:else}
                <input
                  type="text"
                  bind:value={item.name}
                  maxlength="60"
                  autocomplete="off"
                  class="min-h-11 rounded-lg border border-slate-300 px-3 text-lg text-slate-900"
                />
              {/if}
            </label>
            <button
              type="button"
              class="min-h-11 min-w-11 shrink-0 rounded-lg text-sm text-slate-500 underline"
              onclick={() => removePending(item.key)}
              aria-label="Don't add {item.name || 'this photo'}">Remove</button
            >
          </li>
        {/each}
      </ul>
      {#if saveError}
        <p class="text-sm text-red-700" role="alert">{saveError}</p>
      {/if}
      <div class="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="min-h-11 rounded-lg px-4 text-slate-700 underline"
          onclick={clearPending}
          disabled={saving}>Cancel</button
        >
        <button
          type="submit"
          class="min-h-11 rounded-lg bg-blue-600 px-5 font-semibold text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving
            ? "Saving…"
            : pending.length === 1
              ? "Save photo"
              : `Save ${pending.length} photos`}
        </button>
      </div>
    </form>
  {/if}

  {#if loadError}
    <p class="text-red-700" role="alert">{loadError}</p>
  {:else if loaded && uploads.length === 0 && pending.length === 0}
    <p class="py-6 text-center text-slate-500">
      No photos yet. Tap <strong>Add photo</strong> to choose from your photos or
      take a new one.
    </p>
  {/if}

  {#if uploads.length > 0}
    <ul class="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
      {#each uploads as record (record.id)}
        <li class="flex flex-col items-stretch gap-1">
          <button
            type="button"
            class="flex flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white p-2 focus-visible:border-blue-500 focus-visible:outline-none active:border-blue-500"
            onclick={() =>
              onselect({ kind: "upload", id: record.id, label: record.name })}
          >
            <img
              src={objectUrlForRecord(record)}
              alt=""
              class="aspect-square w-full min-w-24 object-contain"
              draggable="false"
            />
            <span
              class="w-full truncate text-center text-base font-medium text-slate-900"
              >{record.name}</span
            >
          </button>

          {#if renamingId === record.id}
            <form class="flex flex-col gap-1" onsubmit={submitRename}>
              <input
                type="text"
                bind:value={renameValue}
                maxlength="60"
                autocomplete="off"
                aria-label="New name for {record.name}"
                class="min-h-11 rounded-lg border border-slate-300 px-2 text-base"
                use:selectFocus
              />
              <div class="flex justify-between">
                <button
                  type="button"
                  class="min-h-11 px-1 text-sm text-slate-600 underline"
                  onclick={() => (renamingId = null)}>Cancel</button
                >
                <button
                  type="submit"
                  class="min-h-11 px-1 text-sm font-semibold text-blue-700 underline"
                  >Save</button
                >
              </div>
            </form>
          {:else}
            <div class="flex justify-between text-sm text-slate-500">
              <button
                type="button"
                class="min-h-11 px-1 underline"
                onclick={() => startRename(record)}
                aria-label="Rename {record.name}">Rename</button
              >
              <button
                type="button"
                class="min-h-11 px-1 underline"
                onclick={() => confirmDelete(record)}
                aria-label="Delete {record.name}">Delete</button
              >
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
