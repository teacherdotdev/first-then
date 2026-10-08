<!-- The two FIRST / THEN panels. Side by side whenever there is room, stacked on phones. -->
<script lang="ts">
  import { app, headingFor } from "#lib/state.svelte.ts";
  import type { SlotName } from "#lib/types.ts";
  import Slot from "./Slot.svelte";

  let {
    onpick,
    oneditlabel,
  }: {
    onpick: (slot: SlotName) => void;
    oneditlabel: (slot: SlotName) => void;
  } = $props();

  const first = $derived(app.board.first);
  const then = $derived(app.board.then);
</script>

<div
  class="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-[clamp(0.5rem,2.5vmin,1.75rem)] sm:grid-cols-2 sm:grid-rows-1"
>
  <Slot
    name="first"
    heading={headingFor(app.settings, "first")}
    symbol={first}
    done={app.board.firstDone}
    favorite={first ? app.isFavorite(first) : false}
    onpick={() => onpick("first")}
    ontoggledone={() => app.toggleFirstDone()}
    oneditlabel={() => oneditlabel("first")}
    ontogglefavorite={() => first && app.toggleFavorite(first)}
  />
  <Slot
    name="then"
    heading={headingFor(app.settings, "then")}
    symbol={then}
    favorite={then ? app.isFavorite(then) : false}
    onpick={() => onpick("then")}
    oneditlabel={() => oneditlabel("then")}
    ontogglefavorite={() => then && app.toggleFavorite(then)}
  />
</div>
