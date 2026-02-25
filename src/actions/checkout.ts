import * as price from "@/collections/price";
import { stripe } from "@/lib/payments/client";
import { metadata } from "@/lib/payments/metadata";
import { ActionError, defineAction } from "astro:actions";
import { CONTEXT } from "astro:env/client";
import { DEPLOY_PRIME_URL } from "astro:env/server";
import { z } from "astro:schema";

export const checkout = defineAction({
  input: z.object({
    price: price.schema,
    metadata,
    email: z.string().optional(),
  }),
  handler: async ({
    price: { id, mode, hasPromotion, qtyAdjustable, maxQty },
    metadata,
    email,
  }) => {
    try {
      const previewMeta =
        CONTEXT !== "production" && DEPLOY_PRIME_URL
          ? { deployPreviewUrl: DEPLOY_PRIME_URL }
          : {};

      const enrichedMetadata = metadata
        ? { ...metadata, ...previewMeta }
        : Object.keys(previewMeta).length > 0
          ? previewMeta
          : undefined;

      const intent = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode,
        line_items: [
          {
            price: id,
            quantity: 1,
            ...(qtyAdjustable
              ? {
                  adjustable_quantity: {
                    enabled: qtyAdjustable,
                    maximum: maxQty,
                  },
                }
              : {}),
          },
        ],
        redirect_on_completion: "never",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: enrichedMetadata as Record<string, string> | undefined,
        ...(mode === "subscription" && enrichedMetadata
          ? {
              subscription_data: {
                metadata: enrichedMetadata as Record<string, string>,
              },
            }
          : {}),
        allow_promotion_codes: hasPromotion,
        customer_email: email,
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
