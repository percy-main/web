import * as db from "@/lib/db/client";
import * as email from "@/lib/email/send";
import { passkey } from "@better-auth/passkey";
import { render } from "@react-email/render";
import { DEPLOY_PRIME_URL } from "astro:env/server";
import { betterAuth } from "better-auth";
import { admin, twoFactor } from "better-auth/plugins";
import { ResetPassword } from "~/emails/ResetPassword";
import { VerifyEmail } from "~/emails/VerifyEmail";

const { baseURL } = await (
  import.meta.env.CLI === "true"
    ? () => ({
        baseURL: import.meta.env.BASE_URL,
      })
    : async () => {
        const client = await import("astro:env/client");
        return {
          baseURL: client.BASE_URL,
        };
      }
)();

export const auth = betterAuth({
  appName: import.meta.env.BETTER_AUTH_RP_NAME as string,
  trustedOrigins: [DEPLOY_PRIME_URL].filter(Boolean),
  database: {
    type: "sqlite",
    dialect: db.dialect,
  },
  plugins: [
    passkey({
      rpID: import.meta.env.BETTER_AUTH_RP_ID as string,
      rpName: import.meta.env.BETTER_AUTH_RP_NAME as string,
    }),
    twoFactor(),
    admin(),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await email.send({
        to: user.email,
        subject: ResetPassword.subject,
        html: await render(
          <ResetPassword.component
            url={url}
            imageBaseUrl={`${baseURL}/images`}
            name={user.name}
          />,
          {
            pretty: true,
          },
        ),
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await email.send({
        to: user.email,
        subject: VerifyEmail.subject,
        html: await render(
          <VerifyEmail.component
            url={url}
            imageBaseUrl={`${baseURL}/images`}
            name={user.name}
          />,
          {
            pretty: true,
          },
        ),
      });
    },
  },
});
