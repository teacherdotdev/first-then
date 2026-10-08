<!-- OWNER: uploads agent. Stub. Grid of "My photos" with add/rename/delete; calls onselect with an 'upload' SymbolRef. -->
<script lang="ts">
  import type { SymbolRef } from "#lib/types.ts";

  let { onselect }: { onselect: (ref: SymbolRef) => void } = $props();
  void onselect;
</script>

<p>Uploads coming soon.</p>
