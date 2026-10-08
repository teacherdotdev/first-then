<!-- Renders a SymbolRef's picture: an ARASAAC pictogram or a photo from this device. -->
<script lang="ts">
  import { pictogramUrl } from "#lib/arasaac/api.ts";
  import { uploadObjectUrl, uploadsVersion } from "#lib/uploads/db.ts";
  import type { SymbolRef } from "#lib/types.ts";
  import Icon from "./Icon.svelte";

  let {
    symbol,
    size = 500,
    class: className = "",
  }: { symbol: SymbolRef; size?: 300 | 500; class?: string } = $props();

  /** undefined while loading, null when the photo is missing. */
  let uploadUrl = $state<string | null | undefined>(undefined);
  let failedSrc = $state<string | null>(null);
  let resolvedId: string | null = null;

  $effect(() => {
    if (symbol.kind !== "upload") return;
    const id = symbol.id;
    // Re-resolve when photos are renamed, replaced, deleted or restored, so a
    // revoked object URL is never shown.
    uploadsVersion();
    let cancelled = false;
    // Only show the loading state for a different photo (avoids flicker on refresh).
    if (resolvedId !== id) uploadUrl = undefined;
    resolvedId = id;
    uploadObjectUrl(id).then(
      (url) => {
        if (!cancelled) uploadUrl = url;
      },
      () => {
        if (!cancelled) uploadUrl = null;
      },
    );
    return () => {
      cancelled = true;
    };
  });

  const src = $derived(
    symbol.kind === "arasaac"
      ? pictogramUrl(symbol.id, size)
      : (uploadUrl ?? null),
  );
  const alt = $derived(symbol.label || "Symbol");
  const missing = $derived(
    (symbol.kind === "upload" && uploadUrl === null) ||
      (src !== null && failedSrc === src),
  );
</script>

{#if missing}
  <div
    class="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center text-slate-500 {className}"
    role="img"
    aria-label={symbol.kind === "upload"
      ? `${alt} (photo not on this device)`
      : `${alt} (picture could not load)`}
  >
    <Icon name="photo" class="size-1/3 max-h-24 max-w-24" />
    <span class="text-sm leading-tight font-semibold">
      {symbol.kind === "upload"
        ? "Photo not on this device"
        : "Picture not loaded"}
    </span>
  </div>
{:else if src}
  <img
    {src}
    {alt}
    class="h-full w-full object-contain select-none {className}"
    draggable="false"
    onerror={() => (failedSrc = src)}
  />
{:else}
  <div
    class="h-full w-full animate-pulse rounded-xl bg-slate-100 {className}"
    role="img"
    aria-label={alt}
  ></div>
{/if}
