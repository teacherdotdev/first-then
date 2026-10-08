<!-- Search box + results grid for ARASAAC pictograms; calls onselect with an 'arasaac' SymbolRef. -->
<script lang="ts">
  import type { Language, SymbolRef } from "#lib/types.ts";
  import {
    ArasaacSearchError,
    canSearchMore,
    normalizeQuery,
    pictogramUrl,
    searchPictograms,
    type ArasaacErrorKind,
    type ArasaacResult,
  } from "./api.ts";

  let {
    language,
    onselect,
  }: { language: Language; onselect: (ref: SymbolRef) => void } = $props();

  const STRINGS = {
    en: {
      label: "Search symbols",
      placeholder: "Search symbols, e.g. snack",
      hint: "Type a word, like snack, bathroom or work.",
      searching: "Searching…",
      none: (q: string) => `No symbols found for “${q}”. Try another word.`,
      offline: "No internet connection. Connect to search symbols.",
      server: "ARASAAC isn't responding. Try again in a moment.",
      retry: "Try again",
      more: "More results",
    },
    es: {
      label: "Buscar pictogramas",
      placeholder: "Buscar pictogramas, p. ej. merienda",
      hint: "Escribe una palabra, como merienda, baño o trabajo.",
      searching: "Buscando…",
      none: (q: string) =>
        `No hay pictogramas para «${q}». Prueba con otra palabra.`,
      offline: "Sin conexión a internet. Conéctate para buscar pictogramas.",
      server: "ARASAAC no responde. Inténtalo de nuevo en un momento.",
      retry: "Reintentar",
      more: "Más resultados",
    },
  } as const;

  const DEBOUNCE_MS = 300;

  let t = $derived(STRINGS[language] ?? STRINGS.en);

  let query = $state("");
  let results = $state<ArasaacResult[]>([]);
  let status = $state<"idle" | "loading" | "done" | "error">("idle");
  let errorKind = $state<ArasaacErrorKind>("offline");
  /** Normalized query the current results belong to. */
  let shownQuery = $state("");
  let moreAvailable = $state(false);
  let loadingMore = $state(false);
  let input = $state<HTMLInputElement>();

  let controller: AbortController | null = null;
  /** `${language}:${query}:${more}` of the latest started search, to skip duplicates. */
  let lastKey = "";

  function run(q: string, lang: Language, more = false, force = false) {
    const normalized = normalizeQuery(q);
    const key = `${lang}:${normalized}:${more}`;
    if (!force && key === lastKey && status !== "error") return;
    lastKey = key;
    controller?.abort();
    controller = null;

    if (!normalized) {
      results = [];
      shownQuery = "";
      moreAvailable = false;
      status = "idle";
      return;
    }

    const c = new AbortController();
    controller = c;
    status = "loading";
    loadingMore = more;
    searchPictograms(q, lang, c.signal, { more })
      .then((found) => {
        if (c.signal.aborted) return;
        results = found;
        shownQuery = normalized;
        moreAvailable = !more && canSearchMore(q, lang);
        status = "done";
      })
      .catch((err: unknown) => {
        if (c.signal.aborted) return;
        errorKind = err instanceof ArasaacSearchError ? err.kind : "server";
        status = "error";
      })
      .finally(() => {
        if (controller === c) {
          controller = null;
          loadingMore = false;
        }
      });
  }

  // Debounced search as the teacher types (or when the language changes).
  $effect(() => {
    const q = query;
    const lang = language;
    const timer = setTimeout(() => run(q, lang), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  // Abort any in-flight request when the picker closes.
  $effect(() => () => controller?.abort());

  // Autofocus the search box when the picker opens.
  $effect(() => {
    input?.focus();
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    run(query, language);
    // Hide the on-screen keyboard so the results are visible on tablets.
    input?.blur();
  }

  function choose(result: ArasaacResult) {
    onselect({ kind: "arasaac", id: result.id, label: result.keyword });
  }
</script>

<div class="flex flex-col gap-4">
  <form role="search" onsubmit={submit} class="flex gap-2">
    <input
      bind:this={input}
      bind:value={query}
      type="search"
      inputmode="search"
      enterkeyhint="search"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-label={t.label}
      placeholder={t.placeholder}
      lang={language}
      class="h-16 min-w-0 flex-1 rounded-2xl border-2 border-slate-300 bg-white px-4 text-2xl text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
    />
  </form>

  <div aria-live="polite" class="text-lg text-slate-700">
    {#if status === "idle"}
      <p>{t.hint}</p>
    {:else if status === "loading" && !loadingMore}
      <p class="flex items-center gap-3">
        <span
          class="inline-block size-6 rounded-full border-4 border-slate-300 border-t-sky-600 motion-safe:animate-spin"
          aria-hidden="true"
        ></span>
        {t.searching}
      </p>
    {:else if status === "error"}
      <div class="flex flex-wrap items-center gap-3">
        <p>{errorKind === "offline" ? t.offline : t.server}</p>
        <button
          type="button"
          onclick={() => run(query, language, false, true)}
          class="min-h-12 rounded-xl bg-sky-700 px-5 text-lg font-semibold text-white active:bg-sky-800"
        >
          {t.retry}
        </button>
      </div>
    {:else if status === "done" && results.length === 0}
      <p>{t.none(shownQuery)}</p>
    {/if}
  </div>

  {#if results.length > 0}
    <ul
      class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3 transition-opacity"
      class:opacity-50={status === "loading" && !loadingMore}
      lang={language}
    >
      {#each results as result (result.id)}
        <li>
          <button
            type="button"
            onclick={() => choose(result)}
            aria-label={result.keyword}
            class="flex h-full w-full flex-col items-center gap-1 rounded-2xl border-2 border-slate-200 bg-white p-2 text-slate-900 active:border-sky-600 active:bg-sky-50"
          >
            <img
              src={pictogramUrl(result.id, 300)}
              alt={result.keyword}
              loading="lazy"
              decoding="async"
              width="300"
              height="300"
              class="aspect-square h-auto w-full object-contain"
            />
            <span class="line-clamp-2 text-center text-lg leading-tight"
              >{result.keyword}</span
            >
          </button>
        </li>
      {/each}
    </ul>

    {#if moreAvailable || loadingMore}
      <button
        type="button"
        disabled={loadingMore}
        onclick={() => run(query, language, true)}
        class="flex min-h-14 items-center justify-center gap-3 self-center rounded-xl border-2 border-sky-700 px-6 text-lg font-semibold text-sky-800 active:bg-sky-50 disabled:opacity-60"
      >
        {#if loadingMore}
          <span
            class="inline-block size-5 rounded-full border-4 border-slate-300 border-t-sky-600 motion-safe:animate-spin"
            aria-hidden="true"
          ></span>
          {t.searching}
        {:else}
          {t.more}
        {/if}
      </button>
    {/if}
  {/if}
</div>
