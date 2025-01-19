import { defineAuthAction } from "../lib/auth/api";
import { stripe } from "../lib/payments/client";

const stripeDate = (d: number) => new Date(d * 1000);

export const subscriptions = defineAuthAction({
  requireVerifiedEmail: true,
  handler: async (_, { user }) => {
    try {
      const customers = await stripe.customers.search({
        query: `email:"${user.email}"`,
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

      const subscriptionsData = subscriptions.data.map((s) => ({
        id: s.id,
        created: stripeDate(s.created),
        paidUntil: stripeDate(s.current_period_end),
        name: s.items.data[0]?.plan.nickname,
        status: s.status,
      }));

      return {
        subscriptions: subscriptionsData,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
});
