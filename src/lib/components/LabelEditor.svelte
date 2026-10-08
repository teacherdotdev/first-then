<!-- Small sheet for changing the word shown under a symbol. -->
<script lang="ts">
  import { MAX_LABEL_LENGTH } from "#lib/state.svelte.ts";
  import type { SymbolRef } from "#lib/types.ts";
  import Modal from "./Modal.svelte";
  import SymbolImage from "./SymbolImage.svelte";

  let {
    heading,
    symbol,
    onsave,
    onclose,
  }: {
    heading: string;
    symbol: SymbolRef;
    onsave: (label: string) => void;
    onclose: () => void;
  } = $props();

  // Editing starts from the current word; later prop changes are ignored on purpose.
  // svelte-ignore state_referenced_locally
  let value = $state(symbol.label);
  let input: HTMLInputElement;

  $effect(() => {
    input.focus();
    input.select();
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onsave(value);
  }
</script>

<Modal title="Word for {heading}" size="small" {onclose}>
  <form class="flex flex-col gap-4 p-5" onsubmit={submit}>
    <div class="mx-auto size-28">
      <SymbolImage {symbol} size={300} />
    </div>
    <label class="flex flex-col gap-1">
      <span class="font-semibold">Word under the picture</span>
      <input
        bind:this={input}
        bind:value
        type="text"
        maxlength={MAX_LABEL_LENGTH}
        autocomplete="off"
        autocapitalize="off"
        enterkeyhint="done"
        class="min-h-12 rounded-xl border-2 border-slate-300 px-3 text-xl focus:border-accent focus:outline-none"
      />
      <span class="text-sm text-slate-500">Leave empty to show no word.</span>
    </label>
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="min-h-12 rounded-full px-5 font-semibold text-slate-700 hover:bg-slate-100"
        onclick={onclose}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="min-h-12 rounded-full bg-accent px-6 font-semibold text-white active:bg-accent-dark"
      >
        Save
      </button>
    </div>
  </form>
</Modal>
