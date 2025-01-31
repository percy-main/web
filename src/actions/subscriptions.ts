import { defineAuthAction } from "../lib/auth/api";
import { stripe } from "../lib/payments/client";

const stripeDate = (d: number) => new Date(d * 1000);

export const subscriptions = defineAuthAction({
  requireVerifiedEmail: true,
  handler: async (_, { user }) => {
    try {
      const customers = await stripe.customers.search({
        query: `email:"${user.email}"`,
        // expand: ["data.plan.product"],
      });

      const customer = customers.data[0];

      if (customers.data.length !== 1 || !customer) {
        return {
          subscriptions: [],
        };
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
      });

      const subscriptionsData = await Promise.all(
        subscriptions.data.map(async (s) => {
          const productId = s.items.data[0]?.plan.product;

          if (!productId) {
            throw new Error("Missing productId on subscription item");
          }

          const product =
            typeof productId === "string"
              ? await stripe.products.retrieve(productId)
              : productId;

          return {
            id: s.id,
            created: stripeDate(s.created),
            paidUntil: stripeDate(s.current_period_end),
            name: s.items.data[0]?.plan.nickname,
            status: s.status,
            product: {
              id: product.id,
              name: product.deleted ? "Deleted product" : product.name,
            },
          };
        }),
      );

      return {
        subscriptions: subscriptionsData,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
});
