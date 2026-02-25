import { client } from "@/lib/db/client";
import type Stripe from "stripe";

export const paymentIntentSucceeded = async (
  event: Stripe.PaymentIntentSucceededEvent,
) => {
  const { metadata } = event.data.object;

  if (metadata.type !== "charges") {
    return;
  }

  const chargeIds = metadata.chargeIds?.split(",").filter(Boolean);

  if (!chargeIds || chargeIds.length === 0) {
    console.error(
      "payment_intent.succeeded: missing chargeIds in metadata",
      event.id,
    );
    return;
  }

  const paymentIntentId = event.data.object.id;
  const paidAt = new Date().toISOString();

  for (const chargeId of chargeIds) {
    // Idempotency: skip charges that are already paid
    const charge = await client
      .selectFrom("charge")
      .where("id", "=", chargeId)
      .select(["id", "paid_at"])
      .executeTakeFirst();

    if (!charge) {
      console.error(
        `payment_intent.succeeded: charge ${chargeId} not found`,
      );
      continue;
    }

    if (charge.paid_at) {
      // Already paid, skip for idempotency
      continue;
    }

    await client
      .updateTable("charge")
      .set({
        paid_at: paidAt,
        stripe_payment_intent_id: paymentIntentId,
      })
      .where("id", "=", chargeId)
      .execute();
  }
};
