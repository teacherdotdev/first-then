<!-- One card of the board: big heading, white symbol box, small teacher controls. -->
<script lang="ts">
  import type { SymbolRef } from "#lib/types.ts";
  import Icon from "./Icon.svelte";
  import SymbolImage from "./SymbolImage.svelte";

  let {
    index,
    heading,
    symbol,
    done = false,
    favorite = false,
    onpick,
    ontoggledone,
    oneditlabel,
    ontogglefavorite,
  }: {
    /** Position on the board, 0 = first step. */
    index: number;
    heading: string;
    symbol: SymbolRef | null;
    /** Show the big green checkmark (only used with `ontoggledone`). */
    done?: boolean;
    favorite?: boolean;
    onpick: () => void;
    /** When given, tapping the filled symbol toggles "done". */
    ontoggledone?: () => void;
    oneditlabel: () => void;
    ontogglefavorite: () => void;
  } = $props();

  const headingId = $derived(`slot-heading-${index}`);
  const label = $derived(symbol?.label ?? "");

  const control =
    "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-base font-semibold text-slate-600 transition active:bg-slate-200";
</script>

{#snippet picture(s: SymbolRef)}
  <span class="relative block min-h-0 w-full flex-1">
    <span class="absolute inset-0 flex items-center justify-center">
      <SymbolImage symbol={s} />
    </span>
  </span>
  {#if s.label}
    <span
      class="block w-full shrink-0 pt-1 text-center text-[clamp(1.5rem,min(5.5vmin,9cqw),3.25rem)] leading-tight font-bold break-words text-slate-900"
    >
      {s.label}
    </span>
  {/if}
{/snippet}

<!-- A size container: the text scales with the card, however many share the row. -->
<section
  class="@container flex min-h-0 min-w-0 flex-col rounded-[clamp(1rem,2.5vmin,2rem)] bg-white p-[clamp(0.5rem,2vmin,1.25rem)] shadow-sm ring-1 ring-slate-200"
  aria-labelledby={headingId}
>
  <h2
    id={headingId}
    class="shrink-0 pb-[clamp(0.25rem,1.5vmin,1rem)] text-center text-[clamp(2rem,min(10vmin,16cqw),7.5rem)] leading-none font-extrabold tracking-wide break-words text-slate-800 uppercase"
  >
    {heading}
  </h2>

  <div class="flex min-h-0 flex-1 items-stretch justify-center">
    {#if !symbol}
      <button
        type="button"
        class="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[clamp(0.75rem,2.5vmin,2rem)] border-[3px] border-dashed border-slate-300 bg-slate-50 text-slate-400 transition active:scale-[0.98] active:bg-slate-100"
        onclick={onpick}
        aria-label="Choose a symbol for {heading}"
      >
        <Icon name="plus" class="size-[clamp(3rem,12vmin,7rem)]" />
        <span class="text-lg font-semibold">Tap to choose</span>
      </button>
    {:else if ontoggledone}
      <button
        type="button"
        class="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[clamp(0.75rem,2.5vmin,2rem)] bg-white p-[clamp(0.5rem,2.5vmin,1.5rem)] transition active:scale-[0.98]"
        onclick={ontoggledone}
        aria-pressed={done}
        aria-label={done
          ? `${label || heading}: done. Tap to mark not done.`
          : `${label || heading}. Tap to mark done.`}
      >
        {@render picture(symbol)}
        {#if done}
          <span
            class="done-overlay @container-size absolute inset-0 flex items-center justify-center bg-white/45"
            aria-hidden="true"
          >
            <!-- Sized by both sides so short cards (3+ steps on a phone) keep their word visible. -->
            <span
              class="flex size-[min(40cqw,55cqh,12rem)] items-center justify-center rounded-full border-[clamp(0.2rem,0.6vmin,0.4rem)] border-white bg-done-green text-white shadow-lg"
            >
              <Icon name="check" class="size-3/4 [stroke-width:3]" />
            </span>
          </span>
        {/if}
      </button>
    {:else}
      <div
        class="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[clamp(0.75rem,2.5vmin,2rem)] bg-white p-[clamp(0.5rem,2.5vmin,1.5rem)]"
      >
        {@render picture(symbol)}
      </div>
    {/if}
  </div>

  <!-- Teacher controls: kept small and quiet so the board stays clean. -->
  <div
    class="flex min-h-12 shrink-0 items-end justify-center gap-2 pt-2 @max-[10rem]:gap-1"
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
        <span class="@max-[14rem]:sr-only">Change</span>
      </button>
      <button
        type="button"
        class={control}
        onclick={oneditlabel}
        aria-label="Edit {heading} word"
      >
        <Icon name="pencil" class="size-5" />
        <span class="@max-[25rem]:sr-only">Word</span>
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
