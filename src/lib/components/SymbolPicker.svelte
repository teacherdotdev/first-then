<!-- Full-screen sheet for choosing a slot's symbol: recents/favorites, ARASAAC search, or my photos. -->
<script lang="ts">
  import ArasaacSearch from "#lib/arasaac/ArasaacSearch.svelte";
  import Attribution from "#lib/arasaac/Attribution.svelte";
  import { app } from "#lib/state.svelte.ts";
  import { symbolKey, type SymbolRef } from "#lib/types.ts";
  import UploadPicker from "#lib/uploads/UploadPicker.svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import SymbolImage from "./SymbolImage.svelte";

  type Tab = "recent" | "search" | "photos";

  let {
    heading,
    current,
    onselect,
    onremove,
    onclose,
  }: {
    /** Heading of the slot being filled, e.g. "FIRST". */
    heading: string;
    /** Symbol currently in the slot, if any. */
    current: SymbolRef | null;
    onselect: (ref: SymbolRef) => void;
    onremove: () => void;
    onclose: () => void;
  } = $props();

  const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: "recent", label: "Recent & Favorites", icon: "star" },
    { id: "search", label: "Search symbols", icon: "search" },
    { id: "photos", label: "My photos", icon: "photo" },
  ];

  const hasSaved = app.recents.length > 0 || app.favorites.length > 0;
  let tab = $state<Tab>(hasSaved ? "recent" : "search");
  /** Tabs stay mounted once visited so a search isn't lost when switching. */
  let visited = $state<Record<Tab, boolean>>({
    recent: true,
    search: !hasSaved,
    photos: false,
  });
  const tabButtons: Partial<Record<Tab, HTMLButtonElement>> = $state({});

  function show(next: Tab, focus = false) {
    tab = next;
    visited[next] = true;
    if (focus) tabButtons[next]?.focus();
  }

  function onTabKeydown(event: KeyboardEvent, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    show(tabs[next].id, true);
  }

  const favoriteKeys = $derived(new Set(app.favorites.map(symbolKey)));
  const otherRecents = $derived(
    app.recents.filter((ref) => !favoriteKeys.has(symbolKey(ref))),
  );
</script>

{#snippet tile(ref: SymbolRef)}
  {@const favorite = favoriteKeys.has(symbolKey(ref))}
  <li class="relative">
    <button
      type="button"
      class="flex aspect-[4/5] w-full flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white p-2 transition hover:border-accent active:scale-95"
      onclick={() => onselect(ref)}
      aria-label={ref.label || "Symbol with no word"}
    >
      <span class="relative block min-h-0 w-full flex-1">
        <span class="absolute inset-0 flex items-center justify-center">
          <SymbolImage symbol={ref} size={300} />
        </span>
      </span>
      <span
        class="line-clamp-2 w-full shrink-0 text-center text-base leading-tight font-semibold"
      >
        {ref.label || "(no word)"}
      </span>
    </button>
    <button
      type="button"
      class="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded-full {favorite
        ? 'text-amber-500'
        : 'text-slate-400'}"
      onclick={() => app.toggleFavorite(ref)}
      aria-pressed={favorite}
      aria-label={favorite
        ? `Remove ${ref.label || "symbol"} from favorites`
        : `Add ${ref.label || "symbol"} to favorites`}
    >
      <Icon name="star" filled={favorite} class="size-6 drop-shadow-sm" />
    </button>
  </li>
{/snippet}

<Modal title="Choose {heading}" {onclose}>
  <div
    class="flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 px-2 pt-2 [&::-webkit-scrollbar]:hidden"
    role="tablist"
    aria-label="Where to find a symbol"
  >
    {#each tabs as t, i (t.id)}
      <button
        type="button"
        bind:this={tabButtons[t.id]}
        id="picker-tab-{t.id}"
        role="tab"
        aria-selected={tab === t.id}
        aria-controls="picker-panel-{t.id}"
        tabindex={tab === t.id ? 0 : -1}
        class="-mb-px inline-flex min-h-12 shrink-0 items-center gap-2 rounded-t-xl border-2 px-4 text-base font-semibold whitespace-nowrap {tab ===
        t.id
          ? 'border-slate-200 border-b-white bg-white text-accent-dark'
          : 'border-transparent text-slate-600 hover:bg-slate-100'}"
        onclick={() => show(t.id)}
        onkeydown={(event) => onTabKeydown(event, i)}
      >
        <Icon name={t.icon} class="size-5" filled={t.id === "recent"} />
        {t.label}
      </button>
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <div
      id="picker-panel-recent"
      role="tabpanel"
      aria-labelledby="picker-tab-recent"
      class="p-4"
      hidden={tab !== "recent"}
    >
      {#if app.favorites.length === 0 && app.recents.length === 0}
        <div
          class="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center"
        >
          <p class="text-lg text-slate-600">
            Symbols you pick will show up here, so you can find them again fast.
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              class="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-white"
              onclick={() => show("search", true)}
            >
              <Icon name="search" class="size-5" /> Search symbols
            </button>
            <button
              type="button"
              class="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-accent px-5 font-semibold text-accent-dark"
              onclick={() => show("photos", true)}
            >
              <Icon name="photo" class="size-5" /> My photos
            </button>
          </div>
        </div>
      {:else}
        {#if app.favorites.length > 0}
          <h3 class="mb-2 text-lg font-bold">Favorites</h3>
          <ul
            class="mb-6 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3"
          >
            {#each app.favorites as ref (symbolKey(ref))}
              {@render tile(ref)}
            {/each}
          </ul>
        {/if}
        {#if otherRecents.length > 0}
          <h3 class="mb-2 text-lg font-bold">Recent</h3>
          <ul
            class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3"
          >
            {#each otherRecents as ref (symbolKey(ref))}
              {@render tile(ref)}
            {/each}
          </ul>
        {/if}
        {#if app.favorites.length === 0}
          <p class="mt-6 text-sm text-slate-500">
            Tip: tap a <span class="sr-only">star</span><Icon
              name="star"
              class="inline size-4 align-text-bottom"
            /> to keep a symbol at the top as a favorite.
          </p>
        {/if}
      {/if}
    </div>

    <div
      id="picker-panel-search"
      role="tabpanel"
      aria-labelledby="picker-tab-search"
      class="p-4"
      hidden={tab !== "search"}
    >
      {#if visited.search}
        <ArasaacSearch
          language={app.settings.language}
          defaultAppearance={app.settings.appearance}
          {onselect}
        />
      {/if}
    </div>

    <div
      id="picker-panel-photos"
      role="tabpanel"
      aria-labelledby="picker-tab-photos"
      class="p-4"
      hidden={tab !== "photos"}
    >
      {#if visited.photos}
        <UploadPicker {onselect} />
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div class="min-w-0 flex-1 text-xs text-slate-500">
        <Attribution />
      </div>
      {#if current}
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold text-red-700 hover:bg-red-50"
          onclick={onremove}
        >
          <Icon name="trash" class="size-5" />
          Clear {heading}
        </button>
      {/if}
    </div>
  {/snippet}
</Modal>
