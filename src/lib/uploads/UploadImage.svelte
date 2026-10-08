<!-- Shows an uploaded photo by id. Refreshes when photos change (rename/delete/restore).
     If the photo isn't on this device (e.g. board restored without its photos), shows
     a gentle placeholder instead of a broken image. -->
<script lang="ts">
  import { uploadObjectUrl, uploadsVersion } from "./db.ts";

  let {
    id,
    alt,
    class: className = "",
  }: { id: string; alt: string; class?: string } = $props();

  let src = $state<string | null>(null);
  let missing = $state(false);

  $effect(() => {
    const currentId = id;
    uploadsVersion();
    let cancelled = false;
    uploadObjectUrl(currentId)
      .then((url) => {
        if (cancelled) return;
        src = url;
        missing = url === null;
      })
      .catch(() => {
        if (cancelled) return;
        src = null;
        missing = true;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if src}
  <img {src} {alt} class={className} draggable="false" />
{:else if missing}
  <div
    class="flex items-center justify-center bg-slate-100 p-2 text-center text-sm text-slate-500 {className}"
    role="img"
    aria-label="{alt} (photo not on this device)"
  >
    Photo not on this device
  </div>
{:else}
  <div class="bg-slate-100 {className}" aria-hidden="true"></div>
{/if}
