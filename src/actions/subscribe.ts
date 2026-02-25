import { client } from "@/lib/db/client";
import { stripe } from "@/lib/payments/client";
import { membershipSchema } from "@/lib/payments/metadata";
import { ActionError, defineAction } from "astro:actions";
import { CONTEXT } from "astro:env/client";
import { DEPLOY_PRIME_URL } from "astro:env/server";
import { z } from "astro:schema";
import type Stripe from "stripe";

export const subscribe = defineAction({
  input: z.object({
    priceId: z.string(),
    membership: membershipSchema.shape.membership,
    email: z.string().email(),
  }),
  handler: async ({ priceId, membership, email }) => {
    try {
      // Find or create Stripe customer
      const existing = await stripe.customers.list({ email, limit: 1 });
      let customer: Stripe.Customer;

      if (existing.data.length > 0) {
        customer = existing.data[0];
      } else {
        customer = await stripe.customers.create({ email });
      }

      // Store customer ID on member record
      await client
        .updateTable("member")
        .set({ stripe_customer_id: customer.id })
        .where("email", "=", email)
        .execute();

      const subscriptionMetadata: Record<string, string> = {
        type: "membership",
        membership,
        source: "direct",
        ...(CONTEXT !== "production" && DEPLOY_PRIME_URL
          ? { deployPreviewUrl: DEPLOY_PRIME_URL }
          : {}),
      };

      // Create subscription with incomplete status — payment collected via PaymentElement
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: subscriptionMetadata,
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      if (!paymentIntent?.client_secret) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create subscription payment",
        });
      }

      return {
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
      };
    } catch (err) {
      if (err instanceof ActionError) throw err;
      console.error(err);
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not create subscription",
      });
    }
  },
});
