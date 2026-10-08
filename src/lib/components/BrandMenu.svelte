<!--
  The teacher.dev mark, tucked in the corner of the board. It opens to the credit,
  the about and privacy pages, and the ARASAAC symbol credit, so the board itself
  carries no footer to distract a student.
-->
<script lang="ts">
  import { resolve } from "$app/paths";

  /** Pointing at it is enough on a desktop; nothing has to be clicked. */
  let hovering = $state(false);
  /** Reached with the keyboard, so tabbing through opens it too. */
  let focused = $state(false);
  /** Left open by a tap, which is what an iPad has instead of a hover. */
  let pinned = $state(false);

  let menu: HTMLDivElement;

  const open = $derived(hovering || focused || pinned);

  function close() {
    pinned = false;
    focused = false;
  }
</script>

<!-- iOS Safari does not focus a tapped button, so a tap elsewhere never blurs
     the menu; close it on any press outside instead. -->
<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape") close();
  }}
  onpointerdown={(event) => {
    if (!menu.contains(event.target as Node)) close();
  }}
/>

<div
  bind:this={menu}
  role="presentation"
  class="relative shrink-0"
  onpointerenter={(event) => {
    if (event.pointerType === "mouse") hovering = true;
  }}
  onpointerleave={() => (hovering = false)}
  onfocusin={(event) =>
    (focused = (event.target as Element).matches(":focus-visible"))}
  onfocusout={(event) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null))
      return;
    close();
  }}
>
  <button
    type="button"
    class="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-white active:bg-white aria-expanded:bg-white"
    aria-expanded={open}
    aria-controls="brand-menu-panel"
    aria-label="teacher.dev: about and privacy"
    onclick={() => (pinned = !pinned)}
  >
    <img src="/teacher-dev-logo.svg" alt="" width="26" height="26" />
  </button>

  <!-- Always in the page, so the links stay reachable by keyboard; only shown
       once asked for. The gap above the card is padding, not margin, so the
       pointer crosses it without leaving the menu and closing it. -->
  <div
    id="brand-menu-panel"
    class={open ? "absolute top-full left-0 z-30 pt-2" : "sr-only"}
  >
    <div
      class="grid w-max max-w-[min(20rem,calc(100vw-2rem))] gap-1.5 rounded-xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-slate-200"
    >
      <a
        class="font-bold text-slate-800 hover:underline"
        href="https://teacher.dev"
        target="_blank"
        rel="noopener noreferrer"
      >
        Built by teacher.dev
      </a>
      <p class="flex items-center gap-2 font-semibold text-slate-600">
        <a class="hover:underline" href={resolve("/about")}>About</a>
        <span aria-hidden="true" class="text-slate-300">·</span>
        <a class="hover:underline" href={resolve("/privacy")}>Privacy</a>
      </p>
      <p class="text-xs text-slate-500">
        Symbols by
        <a
          class="underline"
          href="https://arasaac.org"
          target="_blank"
          rel="noopener noreferrer">ARASAAC</a
        >, CC BY-NC-SA
      </p>
    </div>
  </div>
</div>
