<!--
  Renders a SymbolRef's picture: an ARASAAC pictogram or a photo from this device.
  With `lineArt`, pictograms are drawn as bright lines for the high-contrast board.
  Pictograms with skin tones ARASAAC can't draw are recolored on this device.
-->
<script lang="ts">
  import { lineArtUrl, pictogramUrl } from "#lib/arasaac/api.ts";
  import { needsRecolor } from "#lib/arasaac/appearance.ts";
  import { recoloredUrl } from "#lib/arasaac/recolor.ts";
  import { uploadObjectUrl, uploadsVersion } from "#lib/uploads/db.ts";
  import type { SymbolRef } from "#lib/types.ts";
  import Icon from "./Icon.svelte";

  let {
    symbol,
    size = 500,
    lineArt = false,
    class: className = "",
  }: {
    symbol: SymbolRef;
    size?: 300 | 500;
    lineArt?: boolean;
    class?: string;
  } = $props();

  /** A photo, or a pictogram recolored on this device. */
  const madeHere = $derived(
    symbol.kind === "upload" || (!lineArt && needsRecolor(symbol)),
  );

  /** For `madeHere` pictures: undefined while loading, null when missing or failed. */
  let localUrl = $state<string | null | undefined>(undefined);
  let failedSrc = $state<string | null>(null);
  let resolvedKey: string | null = null;

  $effect(() => {
    if (!madeHere) return;
    let key: string;
    let load: () => Promise<string | null>;
    if (symbol.kind === "upload") {
      const id = symbol.id;
      key = `upload:${id}`;
      load = () => uploadObjectUrl(id);
      // Re-resolve when photos are renamed, replaced, deleted or restored, so a
      // revoked object URL is never shown.
      uploadsVersion();
    } else {
      const { id, skin, hair } = symbol;
      key = `arasaac:${id}:${skin}:${hair}`;
      load = () => recoloredUrl(id, { skin, hair });
    }
    let cancelled = false;
    // Only show the loading state for a different picture (avoids flicker on refresh).
    if (resolvedKey !== key) localUrl = undefined;
    resolvedKey = key;
    load().then(
      (url) => {
        if (!cancelled) localUrl = url;
      },
      () => {
        if (!cancelled) localUrl = null;
      },
    );
    return () => {
      cancelled = true;
    };
  });

  const src = $derived(
    madeHere
      ? (localUrl ?? null)
      : symbol.kind === "arasaac"
        ? lineArt
          ? lineArtUrl(symbol.id)
          : pictogramUrl(symbol.id, size, symbol)
        : null,
  );
  const alt = $derived(symbol.label || "Symbol");
  const missing = $derived(
    (madeHere && localUrl === null) || (src !== null && failedSrc === src),
  );
</script>

{#if missing}
  <div
    class="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center text-slate-500 hc:bg-neutral-800 hc:text-neutral-300 {className}"
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
{:else if src && lineArt && symbol.kind === "arasaac"}
  <!-- The black lines on transparent are a mask over a bright fill. The hidden
       image is only there to notice when the picture fails to load. -->
  <span
    class="line-art block h-full w-full bg-hc-bright {className}"
    style:--src={`url("${src}")`}
    role="img"
    aria-label={alt}
  ></span>
  <img {src} alt="" class="hidden" onerror={() => (failedSrc = src)} />
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
    class="h-full w-full animate-pulse rounded-xl bg-slate-100 hc:bg-neutral-800 {className}"
    role="img"
    aria-label={alt}
  ></div>
{/if}

<style>
  .line-art {
    -webkit-mask: var(--src) center / contain no-repeat;
    mask: var(--src) center / contain no-repeat;
  }
</style>
