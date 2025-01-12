import { z } from "astro:schema";
import { ActionError, defineAction } from "astro:actions";
import { stripe } from "@/lib/payments/client";
import * as price from "@/collections/price";

export const checkout = defineAction({
  input: z.object({
    price: price.schema,
    metadata: z.any(),
  }),
  handler: async ({ price: { id, mode, hasPromotion }, metadata }) => {
    try {
      const intent = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode,
        line_items: [
          {
            price: id,
            quantity: 1,
          },
        ],
        redirect_on_completion: "never",
        metadata,
        allow_promotion_codes: hasPromotion,
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
