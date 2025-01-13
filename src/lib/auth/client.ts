import { BASE_URL } from "astro:env/client";
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: BASE_URL,
});
