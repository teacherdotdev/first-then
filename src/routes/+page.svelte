<script lang="ts">
  import { resolve } from "$app/paths";
  import Board from "#lib/components/Board.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import LabelEditor from "#lib/components/LabelEditor.svelte";
  import SymbolPicker from "#lib/components/SymbolPicker.svelte";
  import { app, headingFor } from "#lib/state.svelte.ts";
  import type { BoardState, SlotName, SymbolRef } from "#lib/types.ts";

  let pickerFor = $state<SlotName | null>(null);
  let labelFor = $state<SlotName | null>(null);

  /** Board as it was before "Clear", offered back for a few seconds. */
  let undoBoard = $state<BoardState | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  const isEmpty = $derived(!app.board.first && !app.board.then);
  const labelSymbol = $derived(labelFor ? app.board[labelFor] : null);

  function pick(ref: SymbolRef) {
    if (!pickerFor) return;
    app.setSlot(pickerFor, ref);
    pickerFor = null;
  }

  function clearBoard() {
    if (isEmpty) return;
    undoBoard = $state.snapshot(app.board);
    app.clearBoard();
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undoBoard = null), 8000);
  }

  function undoClear() {
    if (undoBoard) app.restoreBoard(undoBoard);
    undoBoard = null;
    clearTimeout(undoTimer);
  }

  $effect(() => () => clearTimeout(undoTimer));
</script>

<svelte:head>
  <title>First / Then</title>
</svelte:head>

<main
  class="flex h-screen-safe flex-col gap-[clamp(0.25rem,1.5vmin,0.75rem)] overflow-hidden bg-board-pink px-[max(clamp(0.5rem,2.5vmin,1.75rem),env(safe-area-inset-left))] pt-[max(clamp(0.25rem,1vmin,0.75rem),env(safe-area-inset-top))] pb-[max(clamp(0.5rem,2.5vmin,1.75rem),env(safe-area-inset-bottom))]"
>
  <h1 class="sr-only">First / Then board</h1>

  <nav class="flex shrink-0 items-center justify-end gap-2" aria-label="Board">
    <button
      type="button"
      class="inline-flex h-11 items-center gap-2 rounded-full bg-white/20 px-4 text-base font-semibold text-white transition active:bg-white/35 disabled:opacity-50"
      onclick={clearBoard}
      disabled={isEmpty}
    >
      <Icon name="trash" class="size-5" />
      Clear
    </button>
    <a
      href={resolve("/settings")}
      class="inline-flex size-11 items-center justify-center rounded-full bg-white/20 text-white transition active:bg-white/35"
      aria-label="Settings"
    >
      <Icon name="gear" class="size-6" />
    </a>
  </nav>

  <Board
    onpick={(slot) => (pickerFor = slot)}
    oneditlabel={(slot) => (labelFor = slot)}
  />
</main>

{#if undoBoard}
  <div
    class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
    role="status"
  >
    <div
      class="flex items-center gap-3 rounded-full bg-slate-900 py-1.5 pr-1.5 pl-5 text-white shadow-xl"
    >
      <span class="font-semibold">Board cleared</span>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-slate-900"
        onclick={undoClear}
      >
        <Icon name="undo" class="size-5" />
        Undo
      </button>
    </div>
  </div>
{/if}

{#if pickerFor}
  {@const slot = pickerFor}
  <SymbolPicker
    heading={headingFor(app.settings, slot)}
    current={app.board[slot]}
    onselect={pick}
    onremove={() => {
      app.clearSlot(slot);
      pickerFor = null;
    }}
    onclose={() => (pickerFor = null)}
  />
{/if}

{#if labelFor && labelSymbol}
  {@const slot = labelFor}
  <LabelEditor
    heading={headingFor(app.settings, slot)}
    symbol={labelSymbol}
    onsave={(label) => {
      app.setLabel(slot, label);
      labelFor = null;
    }}
    onclose={() => (labelFor = null)}
  />
{/if}
