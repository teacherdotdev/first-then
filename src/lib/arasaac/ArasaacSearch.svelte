<!-- OWNER: ARASAAC agent. Stub. Search box + results grid; calls onselect with an 'arasaac' SymbolRef. -->
<script lang="ts">
  import type { Language, SymbolRef } from "#lib/types.ts";

  let {
    language,
    onselect,
  }: { language: Language; onselect: (ref: SymbolRef) => void } = $props();
  void language;
  void onselect;
</script>

<p>ARASAAC search coming soon.</p>
