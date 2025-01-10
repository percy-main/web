import { z } from "astro:schema";
import { ActionError, defineAction } from "astro:actions";
import { stripe } from "@/lib/payments/client";

export const checkout = defineAction({
  input: z.object({
    priceId: z.string(),
    mode: z.enum(["payment", "subscription"]),
    metadata: z.any(),
  }),
  handler: async ({ priceId, mode, metadata }) => {
    try {
      const intent = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        redirect_on_completion: "never",
        metadata,
      });

      if (!intent.client_secret) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not generate checkout",
        });
      }

      return {
        clientSecret: intent.client_secret,
      };
    } catch (err) {
      console.error(err);
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not generate checkout",
      });
    }
  },
});
