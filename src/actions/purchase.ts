import { stripe } from "@/lib/payments/client";
import { metadata } from "@/lib/payments/metadata";
import { ActionError, defineAction } from "astro:actions";
import { CONTEXT } from "astro:env/client";
import { DEPLOY_PRIME_URL } from "astro:env/server";
import { z } from "astro:schema";
import type Stripe from "stripe";

export const purchase = defineAction({
  input: z.object({
    priceId: z.string(),
    quantity: z.number().min(1).default(1),
    metadata,
    email: z.string().optional(),
  }),
  handler: async ({ priceId, quantity, metadata, email }) => {
    try {
      const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });

      if (!price.unit_amount) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Price has no unit amount",
        });
      }

      if (price.recurring) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            "Subscription prices are not supported — use checkout instead",
        });
      }

      const product = price.product as Stripe.Product;
      const amount = price.unit_amount * quantity;

      const enrichedMetadata: Record<string, string> = {
        ...(metadata ?? {}),
        priceId,
        ...(email ? { email } : {}),
        ...(CONTEXT !== "production" && DEPLOY_PRIME_URL
          ? { deployPreviewUrl: DEPLOY_PRIME_URL }
          : {}),
      };

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: price.currency,
        metadata: enrichedMetadata,
      });

      if (!paymentIntent.client_secret) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create payment",
        });
      }

      return {
        clientSecret: paymentIntent.client_secret,
        amount,
        productName: product.name,
      };
    } catch (err) {
      if (err instanceof ActionError) throw err;
      console.error(err);
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not create payment",
      });
    }
  },
});
