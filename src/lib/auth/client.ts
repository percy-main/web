import {
  adminClient,
  passkeyClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL = await (async () => {
  if (import.meta.env.CLI === "true") {
    return import.meta.env.BASE_URL;
  }
  if (typeof window !== "undefined") {
    return undefined;
  }
  const env = await import("astro:env/client");
  return env.BASE_URL;
})();

const clientConfig = {
  ...(baseURL && { baseURL }),
  plugins: [passkeyClient(), twoFactorClient(), adminClient()],
};

export const authClient = createAuthClient(clientConfig);
export const { useSession } = authClient;

// needed for CLI
export default authClient;
