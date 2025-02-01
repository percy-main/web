import * as db from "@/lib/db/client";
import * as email from "@/lib/email/send";
import { render } from "@react-email/render";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import { VerifyEmail } from "~/emails/VerifyEmail";

const baseURL = await (
  import.meta.env.CLI === "true"
    ? () => import.meta.env.BASE_URL
    : async () => {
        const env = await import("astro:env/client");
        return env.BASE_URL;
      }
)();

export const auth = betterAuth({
  appName: import.meta.env.BETTER_AUTH_RP_NAME as string,
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
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await email.send({
        to: user.email,
        subject: "Verify your email address",
        html: await render(
          <VerifyEmail
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
