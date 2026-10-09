<!--
  The step panels, left to right. Side by side whenever there is room; on phones two
  steps stack, three stack, and four make a 2×2 grid.
-->
<script lang="ts">
  import { app, headingFor } from "#lib/state.svelte.ts";
  import type { SlotCount } from "#lib/types.ts";
  import Slot from "./Slot.svelte";

  let {
    onpick,
    oneditlabel,
  }: {
    onpick: (index: number) => void;
    oneditlabel: (index: number) => void;
  } = $props();

  const layouts: Record<SlotCount, string> = {
    2: "grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1",
    3: "grid-cols-1 grid-rows-3 sm:grid-cols-3 sm:grid-rows-1",
    4: "grid-cols-2 grid-rows-2 landscape:grid-cols-4 landscape:grid-rows-1",
  };
</script>

<div
  class="grid min-h-0 flex-1 gap-[clamp(0.5rem,2.5vmin,1.75rem)] {layouts[
    app.settings.slotCount
  ]}"
>
  {#each app.visibleSlots as symbol, index (index)}
    <Slot
      {index}
      heading={headingFor(app.settings, index)}
      {symbol}
      done={app.board.done[index]}
      favorite={symbol ? app.isFavorite(symbol) : false}
      onpick={() => onpick(index)}
      ontoggledone={app.canMarkDone(index)
        ? () => app.toggleDone(index)
        : undefined}
      oneditlabel={() => oneditlabel(index)}
      ontogglefavorite={() => symbol && app.toggleFavorite(symbol)}
    />
  {/each}
</div>
