<script lang="ts">
  import { resolve } from "$app/paths";
  import AppearancePicker from "#lib/arasaac/AppearancePicker.svelte";
  import Attribution from "#lib/arasaac/Attribution.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { app, MAX_HEADING_LENGTH } from "#lib/state.svelte.ts";
  import { DEFAULT_SETTINGS, SLOT_COUNTS, type Language } from "#lib/types.ts";
  import BackupPanel from "#lib/uploads/BackupPanel.svelte";

  interface Choice {
    label: string;
    checked: boolean;
    select: () => void;
  }

  const languages: { id: Language; label: string }[] = [
    { id: "en", label: "English" },
    { id: "es", label: "Español" },
  ];

  const defaultHeadings = $derived(
    DEFAULT_SETTINGS.headings[app.settings.slotCount],
  );

  const headingColumns = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  };

  const stepChoices: Choice[] = $derived(
    SLOT_COUNTS.map((count) => ({
      label: `${count} steps`,
      checked: app.settings.slotCount === count,
      select: () => app.updateSettings({ slotCount: count }),
    })),
  );

  const colorChoices: Choice[] = $derived(
    [false, true].map((high) => ({
      label: high ? "High contrast" : "Standard",
      checked: app.settings.highContrast === high,
      select: () => app.updateSettings({ highContrast: high }),
    })),
  );

  const languageChoices: Choice[] = $derived(
    languages.map((lang) => ({
      label: lang.label,
      checked: app.settings.language === lang.id,
      select: () => app.updateSettings({ language: lang.id }),
    })),
  );

  const card =
    "divide-y divide-slate-100 rounded-2xl bg-white px-4 shadow-sm sm:px-5";
  const row =
    "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6";
  const sectionTitle =
    "px-1 pb-2 text-sm font-bold tracking-wide text-slate-500 uppercase";
</script>

{#snippet segmented(name: string, labelledby: string, choices: Choice[])}
  <div
    role="radiogroup"
    aria-labelledby={labelledby}
    class="inline-flex shrink-0 self-start rounded-full bg-slate-100 p-1 sm:self-auto"
  >
    {#each choices as choice (choice.label)}
      <label
        class="relative inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 font-semibold whitespace-nowrap has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue-700 {choice.checked
          ? 'bg-accent text-white shadow'
          : 'text-slate-700'}"
      >
        <input
          type="radio"
          {name}
          class="sr-only"
          checked={choice.checked}
          onchange={choice.select}
        />
        {choice.label}
      </label>
    {/each}
  </div>
{/snippet}

<svelte:head>
  <title>Settings · First / Then</title>
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
      <h1 class="sr-only">Settings</h1>
    </div>
  </header>

  <main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-5">
    <section aria-labelledby="board-title">
      <h2 id="board-title" class={sectionTitle}>Board</h2>
      <div class={card}>
        <div class={row}>
          <h3 id="steps-title" class="font-semibold">Steps</h3>
          {@render segmented("slot-count", "steps-title", stepChoices)}
        </div>

        <div class="flex flex-col gap-3 py-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 id="headings-title" class="font-semibold">Headings</h3>
              <p class="text-sm text-slate-600">The big word over each step.</p>
            </div>
            <button
              type="button"
              class="min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-accent-dark hover:bg-pink-50"
              onclick={() => app.resetHeadings()}
            >
              Reset<span class="sr-only"> headings</span>
            </button>
          </div>
          <div
            class="grid gap-2 {headingColumns[app.settings.slotCount]}"
            role="group"
            aria-labelledby="headings-title"
          >
            {#each defaultHeadings as placeholder, index (index)}
              <input
                type="text"
                class="min-h-11 min-w-0 rounded-xl border-2 border-slate-300 px-3 text-lg font-bold uppercase focus:border-accent focus:outline-none"
                aria-label="Step {index + 1} heading"
                value={app.settings.headings[app.settings.slotCount][index]}
                {placeholder}
                maxlength={MAX_HEADING_LENGTH}
                autocomplete="off"
                oninput={(e) => app.setHeading(index, e.currentTarget.value)}
              />
            {/each}
          </div>
        </div>

        <div class={row}>
          <div>
            <h3 id="colors-title" class="font-semibold">Colors</h3>
            <p class="text-sm text-slate-600">
              High contrast: yellow line drawings on black.
            </p>
          </div>
          {@render segmented("contrast", "colors-title", colorChoices)}
        </div>
      </div>
    </section>

    <section aria-labelledby="symbols-title">
      <h2 id="symbols-title" class={sectionTitle}>Symbols</h2>
      <div class={card}>
        <div class={row}>
          <div>
            <h3 id="language-title" class="font-semibold">Search language</h3>
            <p class="text-sm text-slate-600">
              Also used for the words under symbols.
            </p>
          </div>
          {@render segmented("language", "language-title", languageChoices)}
        </div>

        <div class="flex flex-col gap-3 py-4">
          <div>
            <h3 class="font-semibold">People in symbols</h3>
            <p class="text-sm text-slate-600">
              Skin and hair color each search starts with. You can change it in
              the search too.
            </p>
          </div>
          <AppearancePicker
            name="default-appearance"
            value={app.settings.appearance}
            onchange={(appearance) => app.updateSettings({ appearance })}
          />
        </div>

        <div class={row}>
          <div>
            <h3 class="font-semibold">Recent symbols</h3>
            <p class="text-sm text-slate-600" role="status">
              {app.recents.length} recent, {app.favorites.length} favorites
            </p>
          </div>
          <button
            type="button"
            class="min-h-11 shrink-0 self-start rounded-full border-2 border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
            disabled={app.recents.length === 0}
            onclick={() => app.clearRecents()}
          >
            Clear recents
          </button>
        </div>
      </div>
    </section>

    <section aria-labelledby="backup-title">
      <h2 id="backup-title" class={sectionTitle}>Photos &amp; backup</h2>
      <div class={card}>
        <BackupPanel />
      </div>
    </section>

    <footer
      class="flex flex-col items-center gap-3 px-1 pb-6 text-center text-sm text-slate-600"
    >
      <p
        class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-semibold"
      >
        <a
          href="https://teacher.dev"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 hover:underline"
        >
          <img src="/teacher-dev-logo.svg" alt="" width="20" height="20" />
          Built by teacher.dev
        </a>
        <a href={resolve("/about")} class="hover:underline">About</a>
        <a href={resolve("/privacy")} class="hover:underline">Privacy</a>
      </p>
      <Attribution />
    </footer>
  </main>
</div>
