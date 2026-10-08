import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  CF_BEACON_TOKEN: {
    public: true,
    // Baked into the prerendered HTML at build time; there is no server.
    static: true,
    // Optional: left unset locally and on preview builds, so they count no visits.
    schema: (value) => value,
    description:
      "Cloudflare Web Analytics token, read by the beacon in app.html. Set only on the production Vercel environment.",
  },
});
