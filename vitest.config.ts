/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    // Vitest configuration options
    env: {
      DB_SYNC_URL: "file:local.db",
    },
  },
});
