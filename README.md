# First / Then

A simple digital FIRST / THEN board for tablets and other devices, built for teachers of students with
high support needs. Pick an AAC symbol (from [ARASAAC](https://arasaac.org)) or one
of your own photos for each side; tap the FIRST picture to mark it done.

- **Everything stays on the device.** Board, favorites and settings live in
  `localStorage`; uploaded photos live in IndexedDB. Nothing is uploaded.
- **Moving devices:** Settings → _Download backup (.zip)_, then _Restore from
  backup_ on the new device. The zip holds `manifest.json` plus `images/`.
- **Supported:** Safari 15.4+ and current Chrome, Edge and Firefox.

## Development

```sh
bun install
# from the workspace root — never run `bun run dev` directly:
./scripts/agent-dev.mjs first-then --no-pocketbase
bun run check && bun run lint && bun run build
```

Analytics: Cloudflare Web Analytics loads only when `PUBLIC_CF_BEACON_TOKEN` is set
at build time (declared in `src/env.ts`). Set it on the **Production** environment in
Vercel only, so local and preview builds count no visits.

Code layout: `src/lib/state.svelte.ts` and `src/lib/components/` (board UI),
`src/lib/arasaac/` (symbol search + attribution), `src/lib/uploads/` (IndexedDB
photos, resizing, backup zip). Shared types are in `src/lib/types.ts`.

## Licensing

App code: Apache-2.0 (see `LICENSE.txt`). ARASAAC pictograms are not bundled; they
are loaded from ARASAAC at runtime. The pictographic symbols used are the property
of the Government of Aragón and have been created by Sergio Palao for ARASAAC
(https://arasaac.org), that distributes them under Creative Commons License
BY-NC-SA. The ARASAAC API may only be used by non-commercial applications.
