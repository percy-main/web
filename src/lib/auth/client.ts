import { BASE_URL } from "astro:env/client";
import { createAuthClient } from "better-auth/client";
import { createAuthClient as createReactClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: BASE_URL,
});

export const reactClient = createReactClient({
  baseURL: BASE_URL,
});

export const { useSession } = reactClient;
