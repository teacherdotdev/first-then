<!-- Skin and hair color swatches for people in ARASAAC pictograms. -->
<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import type { Appearance, Language } from "#lib/types.ts";
  import { HAIR_COLORS, SKIN_TONES, type Swatch } from "./appearance.ts";

  let {
    value,
    onchange,
    language = "en",
    name,
  }: {
    value: Appearance;
    onchange: (value: Appearance) => void;
    language?: Language;
    /** Prefix for the radio groups' names and ids; unique on the page. */
    name: string;
  } = $props();

  const STRINGS = {
    en: { skin: "Skin color", hair: "Hair color" },
    es: { skin: "Color de piel", hair: "Color de pelo" },
  } as const;

  let t = $derived(STRINGS[language] ?? STRINGS.en);
</script>

{#snippet swatches<Id extends string>(
  group: string,
  title: string,
  list: readonly Swatch<Id>[],
  selected: Id,
  select: (id: Id) => void,
)}
  <div class="flex flex-col gap-2">
    <h4 id="{name}-{group}" class="text-sm font-semibold text-slate-600">
      {title}
    </h4>
    <div
      role="radiogroup"
      aria-labelledby="{name}-{group}"
      class="flex flex-wrap gap-2"
    >
      {#each list as swatch (swatch.id)}
        {@const checked = swatch.id === selected}
        <label
          class="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-slate-300 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-700 {checked
            ? 'ring-3 ring-accent ring-offset-2'
            : ''}"
          style:background-color={swatch.hex}
          title={swatch.label[language]}
        >
          <input
            type="radio"
            name="{name}-{group}"
            class="sr-only"
            {checked}
            onchange={() => select(swatch.id)}
          />
          <span class="sr-only">{swatch.label[language]}</span>
          {#if checked}
            <Icon
              name="check"
              class="size-6 {swatch.dark ? 'text-white' : 'text-slate-900'}"
            />
          {/if}
        </label>
      {/each}
    </div>
  </div>
{/snippet}

<div class="flex flex-col gap-4">
  {@render swatches("skin", t.skin, SKIN_TONES, value.skin, (skin) =>
    onchange({ ...value, skin }),
  )}
  {@render swatches("hair", t.hair, HAIR_COLORS, value.hair, (hair) =>
    onchange({ ...value, hair }),
  )}
</div>
