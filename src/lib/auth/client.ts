import { createAuthClient } from "better-auth/client";
import { createAuthClient as createReactClient } from "better-auth/react";

const baseURL = await (
  import.meta.env.CLI === "true"
    ? () => import.meta.env.BASE_URL
    : async () => {
        const env = await import("astro:env/client");
        return env.BASE_URL;
      }
)();

export const authClient = createAuthClient({
  baseURL,
});

export const reactClient = createReactClient({
  baseURL,
});

export const { useSession } = reactClient;

// needed for CLI
export default authClient;
