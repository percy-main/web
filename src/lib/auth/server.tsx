import * as db from "@/lib/db/client";
import * as email from "@/lib/email/send";
import { render } from "@react-email/render";
import { BASE_URL } from "astro:env/client";
import { betterAuth } from "better-auth";
import { VerifyEmail } from "../../../emails/VerifyEmail";

export const auth = betterAuth({
  database: {
    type: "sqlite",
    dialect: db.client,
  },
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await email.send({
        to: user.email,
        subject: "Verify your email address",
        html: await render(
          <VerifyEmail
            url={url}
            imageBaseUrl={`${BASE_URL}/images`}
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
