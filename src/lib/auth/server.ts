import { betterAuth, type BetterAuthOptions } from "better-auth";
import * as db from "@/lib/db/client";
import * as email from "@/lib/email/send";

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
        html: `<p><a href="${url}">Click to verify your email</a></p>`,
      });
    },
  },
});
