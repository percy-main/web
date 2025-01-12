import { z } from "astro/zod";
import { Stripe } from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import { defineCollection } from "astro:content";

const client = new Stripe(STRIPE_SECRET_KEY);

export const schema = z.object({
  id: z.string(),
  mode: z.union([z.literal("payment"), z.literal("subscription")]),
  hasPromotion: z.boolean(),
  formattedPrice: z.string(),
  product: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type Price = z.TypeOf<typeof schema>;

const loader = async () => {
  const prices = await client.prices.list({
    expand: ["data.product"],
  });

  const coupons = await client.coupons.list();

  return prices.data.map((price) => {
    const product = price.product as Stripe.Product;

    console.log(JSON.stringify(price, null, 2));

    return {
      id: price.id,
      mode: price.recurring ? "subscription" : "payment",
      hasPromotion: !!coupons.data.find((c) =>
        c.applies_to?.products.includes(product.id),
      ),
      formattedPrice: price.unit_amount ? `£${price.unit_amount / 100}` : "",
      product: {
        id: product.id,
        name: product.name,
      },
    };
  });
};

export const price = defineCollection({
  schema,
  loader,
});
