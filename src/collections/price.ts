import { z } from "astro/zod";
import { defineCollection } from "astro:content";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import { Stripe } from "stripe";

const client = new Stripe(STRIPE_SECRET_KEY);

export const schema = z.object({
  id: z.string(),
  mode: z.union([z.literal("payment"), z.literal("subscription")]),
  hasPromotion: z.boolean(),
  unitAmount: z.number(),
  formattedPrice: z.string(),
  product: z.object({
    id: z.string(),
    name: z.string(),
  }),
  qtyAdjustable: z.boolean(),
  maxQty: z.number().optional(),
});

export type Price = z.TypeOf<typeof schema>;

const loader = async () => {
  const prices = await client.prices.list({
    expand: ["data.product"],
    limit: 100,
  });

  const coupons = await client.coupons.list({
    expand: ["data.applies_to"],
  });

  return prices.data.map((price) => {
    const product = price.product as Stripe.Product;

    return {
      id: price.id,
      mode: price.recurring ? "subscription" : "payment",
      hasPromotion: !!coupons.data.find((c) =>
        c.applies_to?.products.includes(product.id),
      ),
      unitAmount: price.unit_amount ?? 0,
      formattedPrice: price.unit_amount ? `£${price.unit_amount / 100}` : "",
      product: {
        id: product.id,
        name: product.name,
      },
      qtyAdjustable: product.metadata.adjustable === "false" ? false : true,
      maxQty: product.metadata.max_qty
        ? Number(product.metadata.max_qty)
        : undefined,
    };
  });
};

export const price = defineCollection({
  schema,
  loader,
});
