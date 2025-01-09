import { z } from "astro:schema";
import { ActionError, defineAction } from "astro:actions";
import { stripe } from "@/lib/payments/client";

export const join = defineAction({
  accept: "form",
  input: z.object({
    title: z.string(),
    name: z.string(),
    address: z.string(),
    postcode: z.string(),
    dob: z.string(),
    telephone: z.string(),
    email: z.string(),
    emergency_name: z.string(),
    emergency_telephone: z.string(),
    membership: z.enum(["senior_player", "social"]),
  }),
  handler: async (data) => {
    console.log(JSON.stringify(data, null, 2));

    return;
  },
});
