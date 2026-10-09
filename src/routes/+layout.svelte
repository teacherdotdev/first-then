<script lang="ts">
  import "./layout.css";
  import { keepRecolored } from "#lib/arasaac/saved.ts";
  import favicon from "#lib/assets/favicon.svg";
  import { app } from "#lib/state.svelte.ts";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();

  // Keep recolored pictograms in use stored on this device, so the board works offline.
  $effect(() => {
    keepRecolored([...app.board.slots, ...app.recents, ...app.favorites]);
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
