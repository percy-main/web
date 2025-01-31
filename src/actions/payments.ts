import { defineAuthAction } from "@/lib/auth/api";
import { stripe } from "@/lib/payments/client";
import { stripeDate } from "@/lib/util/stripeDate";
import { getCollection } from "astro:content";
import type Stripe from "stripe";

export const payments = defineAuthAction({
  requireVerifiedEmail: true,
  handler: async (_, { user }) => {
    try {
      const prices = await getCollection("price");
      const customers = await stripe.customers.search({
        query: `email:"${user.email}"`,
      });

      const customer = customers.data[0];

      if (customers.data.length !== 1 || !customer) {
        return {
          charges: [],
        };
      }

      const charges = await stripe.charges.search({
        query: `customer:"${customer.id}"`,
        expand: ["data.invoice.lines.price"],
      });

      const chargesWithPriceData = charges.data.flatMap(
        ({ id, created, amount, invoice }) =>
          (invoice as Stripe.Invoice).lines.data
            .map((l) => prices.find((p) => p.id === l.price?.id))
            .map((price) => ({
              id,
              created: stripeDate(created),
              amount,
              price: price?.data,
            })),
      );

      return {
        charges: chargesWithPriceData,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
});
