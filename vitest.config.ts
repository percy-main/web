/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    exclude: ["e2e/**", "node_modules/**"],
    env: {
      DB_SYNC_URL: "file:local.db",
    },
  },
});
