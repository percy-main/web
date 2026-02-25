import { client } from "@/lib/db/client";
import { stripeDate } from "@/lib/util/stripeDate";
import type Stripe from "stripe";

export const paymentIntentSucceeded = async (
  event: Stripe.PaymentIntentSucceededEvent,
) => {
  const { metadata } = event.data.object;

  if (metadata.type !== "charges") {
    return;
  }

  const paymentIntentId = event.data.object.id;
  const paidAt = stripeDate(event.data.object.created).toISOString();

  // Find charges linked to this payment intent
  const charges = await client
    .selectFrom("charge")
    .where("stripe_payment_intent_id", "=", paymentIntentId)
    .where("paid_at", "is", null)
    .select(["id"])
    .execute();

  if (charges.length === 0) {
    console.error(
      "payment_intent.succeeded: no unpaid charges found for payment intent",
      paymentIntentId,
    );
    return;
  }

  // Mark them as paid (idempotent via paid_at IS NULL guard)
  for (const charge of charges) {
    await client
      .updateTable("charge")
      .set({ paid_at: paidAt })
      .where("id", "=", charge.id)
      .where("paid_at", "is", null)
      .execute();
  }
};
