<!-- Shell for the about and privacy pages: the settings page's top bar, then a
     title and the page's cards. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { resolve } from "$app/paths";
  import Icon from "./Icon.svelte";

  let {
    title,
    lede,
    children,
  }: { title: string; lede: string; children: Snippet } = $props();
</script>

<svelte:head>
  <title>{title} · First / Then</title>
</svelte:head>

<div class="min-h-screen-safe bg-board-bg">
  <header
    class="sticky top-0 z-10 border-b border-slate-200 bg-white text-slate-800"
  >
    <div class="mx-auto flex max-w-3xl items-center gap-2 px-2 py-2">
      <a
        href={resolve("/")}
        class="inline-flex min-h-11 items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-slate-600 active:bg-slate-100"
      >
        <Icon name="back" class="size-6" />
        Back to board
      </a>
    </div>
  </header>

  <main class="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
    <div class="px-1">
      <h1 class="text-3xl font-bold text-slate-800">{title}</h1>
      <p class="mt-1 text-slate-600">{lede}</p>
    </div>
    {@render children()}
  </main>
</div>
