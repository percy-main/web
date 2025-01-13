import { betterAuth } from "better-auth";
import * as db from "@/lib/db/client";

export const auth = betterAuth({
  database: {
    type: "sqlite",
    dialect: db.client,
  },
  emailAndPassword: {
    enabled: true,
  },
});
