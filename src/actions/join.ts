import { z } from "astro:schema";
import { defineAction } from "astro:actions";
import retool from "~/retool.json";
import { RETOOL_API_KEY } from "astro:env/server";

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
    emerg_name: z.string(),
    emerg_phone: z.string(),
    membership: z.enum(["senior_player", "social"]),
  }),
  handler: async ({ membership, ...data }) => {
    try {
      const response = await fetch(
        `${retool.baseURL}/${retool.workflows.register}/startTrigger?workflowApiKey=${RETOOL_API_KEY}`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
      console.log(
        "Player registration webhook",
        response.status,
        await response.json(),
      );
    } catch (err) {
      // Don't throw, we can repair manually and allow them to continue to pay
      console.error({ err, data, membership });
    }

    return {
      membership,
    };
  },
});
