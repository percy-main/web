import {
  adminClient,
  passkeyClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL =
  import.meta.env.CLI === "true" ? import.meta.env.BASE_URL : undefined;

const clientConfig = {
  ...(baseURL && { baseURL }),
  plugins: [passkeyClient(), twoFactorClient(), adminClient()],
};

export const authClient = createAuthClient(clientConfig);
export const { useSession } = authClient;

// needed for CLI
export default authClient;
