import { z } from "astro:schema";
import { ActionError, defineAction } from "astro:actions";
import { stripe } from "@/lib/payments/client";
import { priceSchema } from "@/lib/payments/prices";

export const checkout = defineAction({
  input: z.object({
    price: priceSchema,
    metadata: z.any(),
  }),
  handler: async ({ price: { priceId, mode, hasPromotion }, metadata }) => {
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
