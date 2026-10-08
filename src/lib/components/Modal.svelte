<!-- Accessible modal sheet (no <dialog>, which older iOS 15 Safari lacks). -->
<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    onclose,
    size = "large",
    children,
    footer,
  }: {
    title: string;
    onclose: () => void;
    /** "large" fills most of the screen; "small" is a compact centred card. */
    size?: "large" | "small";
    children: Snippet;
    footer?: Snippet;
  } = $props();

  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  let panel: HTMLDivElement;

  onMount(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Let a child (e.g. an autofocus input) take focus first.
    if (!panel.contains(document.activeElement)) panel.focus();
    return () => previous?.focus();
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
      return;
    }
    if (event.key !== "Tab") return;
    // Keep keyboard focus inside the sheet.
    const focusable = [
      ...panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  }
</script>

<svelte:window {onkeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onclose();
  }}
>
  <div
    bind:this={panel}
    class="flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none {size ===
    'large'
      ? 'h-full max-w-5xl'
      : 'max-w-md'}"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
  >
    <header
      class="flex shrink-0 items-center gap-3 border-b border-slate-200 py-2 pr-2 pl-5"
    >
      <h2 id={titleId} class="flex-1 truncate text-xl font-bold">{title}</h2>
      <button
        type="button"
        class="inline-flex size-12 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200"
        onclick={onclose}
        aria-label="Close"
      >
        <Icon name="close" class="size-7" />
      </button>
    </header>

    <div class="flex min-h-0 flex-1 flex-col">
      {@render children()}
    </div>

    {#if footer}
      <footer class="shrink-0 border-t border-slate-200 px-4 py-2">
        {@render footer()}
      </footer>
    {/if}
  </div>
</div>
