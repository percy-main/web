import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import { stripe } from "@/lib/payments/client";
import { ActionError } from "astro:actions";
import { CONTEXT } from "astro:env/client";
import { DEPLOY_PRIME_URL } from "astro:env/server";
import { z } from "astro:schema";

export const charges = {
  getMyCharges: defineAuthAction({
    input: z.object({}),
    handler: async (_, session) => {
      const member = await client
        .selectFrom("member")
        .where("email", "=", session.user.email)
        .select(["id"])
        .executeTakeFirst();

      if (!member) {
        return { charges: [] };
      }

      const charges = await client
        .selectFrom("charge")
        .where("member_id", "=", member.id)
        .where("deleted_at", "is", null)
        .selectAll()
        .orderBy("charge_date", "desc")
        .execute();

      return { charges };
    },
  }),

  payOutstandingBalance: defineAuthAction({
    input: z.object({}),
    handler: async (_, session) => {
      const member = await client
        .selectFrom("member")
        .where("email", "=", session.user.email)
        .select(["id"])
        .executeTakeFirst();

      if (!member) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "No member record found for your account",
        });
      }

      // Only consider charges with no pending payment intent and not already confirmed
      const unpaidCharges = await client
        .selectFrom("charge")
        .where("member_id", "=", member.id)
        .where("paid_at", "is", null)
        .where("deleted_at", "is", null)
        .where("stripe_payment_intent_id", "is", null)
        .where("payment_confirmed_at", "is", null)
        .selectAll()
        .execute();

      if (unpaidCharges.length === 0) {
        // All charges may already have a pending payment intent — try to reuse it
        const pendingCharge = await client
          .selectFrom("charge")
          .where("member_id", "=", member.id)
          .where("paid_at", "is", null)
          .where("deleted_at", "is", null)
          .where("stripe_payment_intent_id", "is not", null)
          .select(["stripe_payment_intent_id"])
          .executeTakeFirst();

        if (pendingCharge?.stripe_payment_intent_id) {
          const existingIntent = await stripe.paymentIntents.retrieve(
            pendingCharge.stripe_payment_intent_id,
          );

          if (
            existingIntent.client_secret &&
            existingIntent.status !== "succeeded" &&
            existingIntent.status !== "canceled"
          ) {
            return {
              clientSecret: existingIntent.client_secret,
              totalAmountPence: existingIntent.amount,
              chargeIds: [pendingCharge.stripe_payment_intent_id],
            };
          }
        }

        throw new ActionError({
          code: "BAD_REQUEST",
          message: "No outstanding charges to pay",
        });
      }

      const totalAmountPence = unpaidCharges.reduce(
        (sum, c) => sum + c.amount_pence,
        0,
      );

      const chargeIds = unpaidCharges.map((c) => c.id);

      const metadata: Record<string, string> = {
        type: "charges",
        memberEmail: session.user.email,
      };

      if (CONTEXT !== "production" && DEPLOY_PRIME_URL) {
        metadata.deployPreviewUrl = DEPLOY_PRIME_URL;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountPence,
        currency: "gbp",
        metadata,
      });

      if (!paymentIntent.client_secret) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create payment intent",
        });
      }

      // Link charges to the payment intent so the webhook can find them
      for (const charge of unpaidCharges) {
        await client
          .updateTable("charge")
          .set({ stripe_payment_intent_id: paymentIntent.id })
          .where("id", "=", charge.id)
          .where("paid_at", "is", null)
          .where("stripe_payment_intent_id", "is", null)
          .execute();
      }

      return {
        clientSecret: paymentIntent.client_secret,
        totalAmountPence,
        chargeIds,
      };
    },
  }),

  confirmPayment: defineAuthAction({
    input: z.object({
      paymentIntentId: z.string(),
    }),
    handler: async ({ paymentIntentId }, session) => {
      const member = await client
        .selectFrom("member")
        .where("email", "=", session.user.email)
        .select(["id"])
        .executeTakeFirst();

      if (!member) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "No member record found for your account",
        });
      }

      // Verify the payment intent actually succeeded
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Payment has not succeeded",
        });
      }

      await client
        .updateTable("charge")
        .set({ payment_confirmed_at: new Date().toISOString() })
        .where("member_id", "=", member.id)
        .where("stripe_payment_intent_id", "=", paymentIntentId)
        .where("paid_at", "is", null)
        .where("payment_confirmed_at", "is", null)
        .execute();

      return { success: true };
    },
  }),
};
