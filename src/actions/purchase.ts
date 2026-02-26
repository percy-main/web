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
    customAmountPence: z.number().min(1).optional(),
    metadata,
    email: z.string().optional(),
  }),
  handler: async ({ priceId, quantity, customAmountPence, metadata, email }) => {
    try {
      const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });

      if (price.recurring) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            "Subscription prices are not supported — use subscribe instead",
        });
      }

      const product = price.product as Stripe.Product;

      const maxQty = product.metadata.max_qty
        ? Number(product.metadata.max_qty)
        : undefined;
      if (maxQty && quantity > maxQty) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Maximum quantity is ${maxQty}`,
        });
      }

      let amount: number;
      if (price.custom_unit_amount) {
        if (!customAmountPence) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Custom amount is required for this price",
          });
        }
        const min = price.custom_unit_amount.minimum ?? 0;
        const max = price.custom_unit_amount.maximum;
        if (customAmountPence < min || (max && customAmountPence > max)) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: `Amount must be between ${min} and ${max ?? "unlimited"}`,
          });
        }
        amount = customAmountPence;
      } else if (price.unit_amount) {
        amount = price.unit_amount * quantity;
      } else {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Price has no unit amount",
        });
      }

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
        automatic_payment_methods: { enabled: true },
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
