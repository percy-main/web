// @ts-check
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://www.percymain.org",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
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
      DB_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
      DB_SYNC_URL: envField.string({
        context: "server",
        access: "secret",
      }),
      MAILGUN_API_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      MAILGUN_DOMAIN: envField.string({
        context: "server",
        access: "public",
      }),
      MAILGUN_URL: envField.string({
        context: "server",
        access: "public",
      }),
      CDN_ENVIRONMENT: envField.string({
        context: "server",
        access: "public",
      }),
      PLAY_CRICKET_URL: envField.string({
        context: "server",
        access: "secret",
      }),
      PLAY_CRICKET_API_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      PLAY_CRICKET_SITE_ID: envField.string({
        context: "server",
        access: "secret",
      }),
    },
  },

  adapter: netlify(),
});
