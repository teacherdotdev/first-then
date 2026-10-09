<script lang="ts">
  import { resolve } from "$app/paths";
  import Attribution from "#lib/arasaac/Attribution.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { app, MAX_HEADING_LENGTH } from "#lib/state.svelte.ts";
  import { DEFAULT_SETTINGS, SLOT_COUNTS, type Language } from "#lib/types.ts";
  import BackupPanel from "#lib/uploads/BackupPanel.svelte";

  const languages: { id: Language; label: string }[] = [
    { id: "en", label: "English" },
    { id: "es", label: "Español" },
  ];

  const defaultHeadings = $derived(
    DEFAULT_SETTINGS.headings[app.settings.slotCount],
  );

  const contrasts = [
    { high: false, label: "Standard" },
    { high: true, label: "High contrast" },
  ];

  let recentsCleared = $state(false);
</script>

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

  <main class="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
    <section class="rounded-2xl bg-white p-5 shadow-sm">
      <fieldset>
        <legend class="mb-3 text-lg font-bold">Steps on the board</legend>
        <div class="inline-flex rounded-full bg-slate-100 p-1">
          {#each SLOT_COUNTS as count (count)}
            <label
              class="relative inline-flex min-h-12 cursor-pointer items-center rounded-full px-4 text-lg font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue-700 {app
                .settings.slotCount === count
                ? 'bg-accent text-white shadow'
                : 'text-slate-700'}"
            >
              <input
                type="radio"
                name="slot-count"
                class="sr-only"
                value={count}
                checked={app.settings.slotCount === count}
                onchange={() => app.updateSettings({ slotCount: count })}
              />
              {count} steps
            </label>
          {/each}
        </div>
      </fieldset>
    </section>

    <section
      class="rounded-2xl bg-white p-5 shadow-sm"
      aria-labelledby="headings-title"
    >
      <h2 id="headings-title" class="text-lg font-bold">Board headings</h2>
      <p class="mb-4 text-slate-600">The big words over each step.</p>
      <div
        class="grid gap-4 {app.settings.slotCount === 3
          ? 'sm:grid-cols-3'
          : 'sm:grid-cols-2'}"
      >
        {#each defaultHeadings as placeholder, index (index)}
          <label class="flex flex-col gap-1">
            <span class="font-semibold">Step {index + 1}</span>
            <input
              type="text"
              class="min-h-12 rounded-xl border-2 border-slate-300 px-3 text-xl font-bold uppercase focus:border-accent focus:outline-none"
              value={app.settings.headings[app.settings.slotCount][index]}
              {placeholder}
              maxlength={MAX_HEADING_LENGTH}
              autocomplete="off"
              oninput={(e) => app.setHeading(index, e.currentTarget.value)}
            />
          </label>
        {/each}
      </div>
      <button
        type="button"
        class="mt-3 min-h-11 rounded-full px-4 font-semibold text-accent-dark hover:bg-pink-50"
        onclick={() => app.resetHeadings()}
      >
        Reset to {defaultHeadings.join(" / ")}
      </button>
    </section>

    <section class="rounded-2xl bg-white p-5 shadow-sm">
      <fieldset>
        <legend class="text-lg font-bold">Symbol search language</legend>
        <p class="mb-4 text-slate-600">
          Words used to search ARASAAC symbols and for their default labels.
        </p>
        <div class="inline-flex rounded-full bg-slate-100 p-1">
          {#each languages as lang (lang.id)}
            <label
              class="relative inline-flex min-h-12 cursor-pointer items-center rounded-full px-6 text-lg font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue-700 {app
                .settings.language === lang.id
                ? 'bg-accent text-white shadow'
                : 'text-slate-700'}"
            >
              <input
                type="radio"
                name="language"
                class="sr-only"
                value={lang.id}
                checked={app.settings.language === lang.id}
                onchange={() => app.updateSettings({ language: lang.id })}
              />
              {lang.label}
            </label>
          {/each}
        </div>
      </fieldset>
    </section>

    <section class="rounded-2xl bg-white p-5 shadow-sm">
      <fieldset>
        <legend class="text-lg font-bold">Board colors</legend>
        <p class="mb-4 text-slate-600">
          High contrast shows the board on black, with symbols as bright yellow
          line drawings. Photos stay in full color.
        </p>
        <div class="inline-flex rounded-full bg-slate-100 p-1">
          {#each contrasts as option (option.label)}
            <label
              class="relative inline-flex min-h-12 cursor-pointer items-center rounded-full px-6 text-lg font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue-700 {app
                .settings.highContrast === option.high
                ? 'bg-accent text-white shadow'
                : 'text-slate-700'}"
            >
              <input
                type="radio"
                name="contrast"
                class="sr-only"
                checked={app.settings.highContrast === option.high}
                onchange={() =>
                  app.updateSettings({ highContrast: option.high })}
              />
              {option.label}
            </label>
          {/each}
        </div>
      </fieldset>
    </section>

    <section
      class="rounded-2xl bg-white p-5 shadow-sm"
      aria-labelledby="recents-title"
    >
      <h2 id="recents-title" class="text-lg font-bold">Recent symbols</h2>
      <p class="mb-3 text-slate-600">
        {app.recents.length} recent and {app.favorites.length} favorite symbols are
        saved on this device.
      </p>
      <button
        type="button"
        class="min-h-11 rounded-full border-2 border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        disabled={app.recents.length === 0}
        onclick={() => {
          app.clearRecents();
          recentsCleared = true;
        }}
      >
        Clear recent symbols
      </button>
      <span class="ml-2 text-slate-600" role="status">
        {recentsCleared && app.recents.length === 0 ? "Recents cleared." : ""}
      </span>
    </section>

    <section
      class="rounded-2xl bg-white p-5 shadow-sm"
      aria-labelledby="backup-title"
    >
      <h2 id="backup-title" class="mb-3 text-lg font-bold">
        Photos &amp; backup
      </h2>
      <BackupPanel />
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
