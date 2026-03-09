import { stripe } from "@/lib/payments/client";
import { membershipSchema } from "@/lib/payments/metadata";
import { resolveStripeCustomer } from "@/lib/payments/resolveStripeCustomer";
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
      const customerId = await resolveStripeCustomer(email);

      if (!customerId) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not resolve Stripe customer",
        });
      }

      const subscriptionMetadata: Record<string, string> = {
        type: "membership",
        membership,
        source: "direct",
        ...(CONTEXT !== "production" && DEPLOY_PRIME_URL
          ? { deployPreviewUrl: DEPLOY_PRIME_URL }
          : {}),
      };

      // Women's player monthly subscriptions auto-cancel after 6 billing cycles
      let cancelAt: number | undefined;
      if (membership === "senior_women_player") {
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        cancelAt = Math.floor(sixMonthsFromNow.getTime() / 1000);
      }

      // Create subscription with incomplete status — payment collected via PaymentElement
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: subscriptionMetadata,
        ...(cancelAt ? { cancel_at: cancelAt } : {}),
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
