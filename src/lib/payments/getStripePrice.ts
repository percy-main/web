import { stripe } from "@/lib/payments/client";
import { ActionError } from "astro:actions";
import type Stripe from "stripe";

export async function getStripePrice(priceId: string) {
  const price = await stripe.prices.retrieve(priceId, {
    expand: ["product"],
  });
  const product = price.product as Stripe.Product;
  const amount = price.unit_amount;
  if (!amount) {
    throw new ActionError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Price not configured",
    });
  }
  return { amount, currency: price.currency, productName: product.name };
}
