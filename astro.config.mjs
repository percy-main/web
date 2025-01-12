// @ts-check
import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  site: "https://www.percymain.org",
  integrations: [react(), tailwind()],

  env: {
    schema: {
      BASE_URL: envField.string({
        context: "client",
        access: "public",
        default: "https://www.percymain.org",
      }),
      CDN_TOKEN: envField.string({ context: "server", access: "secret" }),
      CDN_CMA_TOKEN: envField.string({ context: "server", access: "secret" }),
      CDN_SPACE_ID: envField.string({ context: "server", access: "secret" }),
      STRIPE_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      STRIPE_PUBLIC_KEY: envField.string({
        context: "client",
        access: "public",
      }),
      STRIPE_WEBHOOK_SECRET: envField.string({
        context: "server",
        access: "secret",
      }),
      RETOOL_API_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      CDN_PREVIEW_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
      MAPS_API_KEY: envField.string({
        context: "client",
        access: "public",
      }),
      MAPS_MAP_ID: envField.string({
        context: "client",
        access: "public",
      }),
    },
  },

  adapter: netlify(),
});
