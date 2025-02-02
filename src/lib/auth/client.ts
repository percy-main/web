import {
  adminClient,
  passkeyClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL = await (
  import.meta.env.CLI === "true"
    ? () => import.meta.env.BASE_URL
    : async () => {
        if (import.meta.env.DEPLOY_URL) {
          return import.meta.env.DEPLOY_URL as string;
        }
        const env = await import("astro:env/client");
        return env.BASE_URL;
      }
)();

const clientConfig = {
  baseURL,
  plugins: [passkeyClient(), twoFactorClient(), adminClient()],
};

export const authClient = createAuthClient(clientConfig);
export const { useSession } = authClient;

// needed for CLI
export default authClient;
