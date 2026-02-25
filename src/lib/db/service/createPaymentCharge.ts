import { randomUUID } from "crypto";
import { client } from "../client";

export type ChargeType =
  | "manual"
  | "donation"
  | "membership"
  | "sponsorship"
  | "junior_membership";

export type ChargeSource = "admin" | "webhook" | "self_service";

interface CreatePaymentChargeParams {
  memberEmail: string;
  description: string;
  amountPence: number;
  chargeDate: Date;
  type: ChargeType;
  source: ChargeSource;
  stripePaymentIntentId?: string;
}

/**
 * Create a charge record from a successful payment.
 *
 * Looks up the member by email. If no member record exists, the charge
 * is silently skipped — only members see transactions in their account.
 */
export async function createPaymentCharge({
  memberEmail,
  description,
  amountPence,
  chargeDate,
  type,
  source,
  stripePaymentIntentId,
}: CreatePaymentChargeParams): Promise<void> {
  const member = await client
    .selectFrom("member")
    .where("email", "=", memberEmail)
    .select(["id"])
    .executeTakeFirst();

  if (!member) {
    return;
  }

  // Check for duplicate charge with the same stripe_payment_intent_id
  if (stripePaymentIntentId) {
    const existing = await client
      .selectFrom("charge")
      .where("stripe_payment_intent_id", "=", stripePaymentIntentId)
      .where("member_id", "=", member.id)
      .where("type", "=", type)
      .select(["id"])
      .executeTakeFirst();

    if (existing) {
      return;
    }
  }

  await client
    .insertInto("charge")
    .values({
      id: randomUUID(),
      member_id: member.id,
      description,
      amount_pence: amountPence,
      charge_date: chargeDate.toISOString().split("T")[0],
      created_by: "system",
      paid_at: chargeDate.toISOString(),
      stripe_payment_intent_id: stripePaymentIntentId ?? null,
      type,
      source,
    })
    .execute();
}
