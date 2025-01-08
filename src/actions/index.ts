import { z } from "astro:schema";
import { ActionError, defineAction } from "astro:actions";
import { stripe } from "@/lib/payments/client";

export const server = {
  checkout: defineAction({
    input: z.object({
      priceId: z.string(),
      metadata: z.any(),
    }),
    handler: async ({ priceId, metadata }) => {
      const intent = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: "payment",
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
    },
  }),
};
