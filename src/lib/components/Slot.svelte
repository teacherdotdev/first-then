<!-- One grey panel of the board: big heading, white symbol box, small teacher controls. -->
<script lang="ts">
  import type { SlotName, SymbolRef } from "#lib/types.ts";
  import Icon from "./Icon.svelte";
  import SymbolImage from "./SymbolImage.svelte";

  let {
    name,
    heading,
    symbol,
    done = false,
    favorite = false,
    onpick,
    ontoggledone,
    oneditlabel,
    ontogglefavorite,
  }: {
    name: SlotName;
    heading: string;
    symbol: SymbolRef | null;
    /** FIRST only: show the big green checkmark. */
    done?: boolean;
    favorite?: boolean;
    onpick: () => void;
    /** When given, tapping the filled symbol toggles "done". */
    ontoggledone?: () => void;
    oneditlabel: () => void;
    ontogglefavorite: () => void;
  } = $props();

  const headingId = $derived(`slot-heading-${name}`);
  const label = $derived(symbol?.label ?? "");

  const control =
    "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-white/70 px-3.5 text-base font-semibold text-slate-700 shadow-sm transition active:bg-white";
</script>

{#snippet picture(s: SymbolRef)}
  <span class="relative block min-h-0 w-full flex-1">
    <span class="absolute inset-0 flex items-center justify-center">
      <SymbolImage symbol={s} />
    </span>
  </span>
  {#if s.label}
    <span
      class="block w-full shrink-0 pt-1 text-center text-[clamp(1.5rem,min(5.5vmin,4.5vw),3.25rem)] leading-tight font-bold break-words text-black"
    >
      {s.label}
    </span>
  {/if}
{/snippet}

<section
  class="flex min-h-0 min-w-0 flex-col rounded-[clamp(0.75rem,2vmin,1.5rem)] bg-board-panel p-[clamp(0.5rem,2vmin,1.25rem)]"
  aria-labelledby={headingId}
>
  <h2
    id={headingId}
    class="shrink-0 pb-[clamp(0.25rem,1.5vmin,1rem)] text-center text-[clamp(2.5rem,min(10vmin,8vw),7.5rem)] leading-none font-black tracking-wide break-words text-black uppercase"
  >
    {heading}
  </h2>

  <div class="flex min-h-0 flex-1 items-stretch justify-center">
    {#if !symbol}
      <button
        type="button"
        class="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[clamp(0.75rem,2.5vmin,2rem)] border-4 border-dashed border-white bg-white/90 text-slate-400 shadow-sm transition active:scale-[0.98]"
        onclick={onpick}
        aria-label="Choose a symbol for {heading}"
      >
        <Icon name="plus" class="size-[clamp(3rem,12vmin,7rem)]" />
        <span class="text-lg font-semibold">Tap to choose</span>
      </button>
    {:else if ontoggledone}
      <button
        type="button"
        class="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[clamp(0.75rem,2.5vmin,2rem)] bg-white p-[clamp(0.5rem,2.5vmin,1.5rem)] shadow-sm transition active:scale-[0.98]"
        onclick={ontoggledone}
        aria-pressed={done}
        aria-label={done
          ? `${label || heading}: done. Tap to mark not done.`
          : `${label || heading}. Tap to mark done.`}
      >
        {@render picture(symbol)}
        {#if done}
          <span
            class="done-overlay absolute inset-0 flex items-center justify-center bg-white/45"
            aria-hidden="true"
          >
            <span
              class="flex aspect-square w-[min(70%,22rem)] items-center justify-center rounded-full border-[clamp(0.3rem,1vmin,0.6rem)] border-white bg-done-green text-white shadow-xl"
            >
              <Icon name="check" class="size-3/4 [stroke-width:3]" />
            </span>
          </span>
        {/if}
      </button>
    {:else}
      <div
        class="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[clamp(0.75rem,2.5vmin,2rem)] bg-white p-[clamp(0.5rem,2.5vmin,1.5rem)] shadow-sm"
      >
        {@render picture(symbol)}
      </div>
    {/if}
  </div>

  <!-- Teacher controls: kept small and quiet so the board stays clean. -->
  <div
    class="flex min-h-12 shrink-0 items-end justify-center gap-2 pt-2"
    class:invisible={!symbol}
    aria-hidden={!symbol}
  >
    {#if symbol}
      <button
        type="button"
        class={control}
        onclick={onpick}
        aria-label="Change {heading} symbol"
      >
        <Icon name="swap" class="size-5" />
        <span>Change</span>
      </button>
      <button
        type="button"
        class={control}
        onclick={oneditlabel}
        aria-label="Edit {heading} word"
      >
        <Icon name="pencil" class="size-5" />
        <span class="max-[420px]:sr-only">Word</span>
      </button>
      <button
        type="button"
        class="{control} w-11 px-0"
        onclick={ontogglefavorite}
        aria-pressed={favorite}
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Icon
          name="star"
          filled={favorite}
          class="size-5 {favorite ? 'text-amber-500' : ''}"
        />
      </button>
    {/if}
  </div>
</section>

<style>
  .done-overlay {
    animation: pop 180ms ease-out;
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .done-overlay {
      animation: none;
    }
  }
</style>
