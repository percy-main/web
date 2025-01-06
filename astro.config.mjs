// @ts-check
import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()],

  env: {
    schema: {
      CDN_TOKEN: envField.string({ context: "server", access: "secret" }),
      CDN_SPACE_ID: envField.string({ context: "server", access: "secret" }),
      STRIPE_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      STRIPE_PUBLIC_KEY: envField.string({
        context: "client",
        access: "public",
      }),
      SPONSORSHIP_PRICE_ID: envField.string({
        context: "client",
        access: "public",
      }),
    },
  },

  adapter: netlify(),
});
