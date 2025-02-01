import { createAuthClient } from "better-auth/client";
import { passkeyClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient as createReactClient } from "better-auth/react";

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

export const authClient = createAuthClient({
  baseURL,
  plugins: [passkeyClient(), twoFactorClient()],
});

export const reactClient = createReactClient({
  baseURL,
  plugins: [passkeyClient(), twoFactorClient()],
});

export const register = ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) =>
  authClient.signUp.email({
    name,
    email,
    password,
    callbackURL: "/auth/email-confirmed/",
  });

export const { useSession } = reactClient;

// needed for CLI
export default authClient;
