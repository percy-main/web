// @ts-check
import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()],
  env: {
    schema: {
      CDN_TOKEN: envField.string({ context: "server", access: "secret" }),
      CDN_SPACE_ID: envField.string({ context: "server", access: "secret" }),
    },
  },
});
