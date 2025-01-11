import { z } from "astro/zod";
import stripeData from "~/stripe.json";

export const priceSchema = z.object({
  priceId: z.string(),
  mode: z.union([z.literal("payment"), z.literal("subscription")]),
  hasPromotion: z.boolean(),
});

export type Price = z.TypeOf<typeof priceSchema>;

const schema = z.object({
  prices: z.object({
    playersAnnually: priceSchema,
    playersMonthly: priceSchema,
    socialAnnually: priceSchema,
    socialMonthly: priceSchema,
    sponsorship: priceSchema,
  }),
});

export const { prices } = schema.parse(stripeData);
