import { client } from "@/lib/db/client";
import {
  createPaymentCharge,
  type ChargeType,
} from "@/lib/db/service/createPaymentCharge";
import { stripeDate } from "@/lib/util/stripeDate";
import type Stripe from "stripe";
import { stripe } from "./client";
import { gameSponsoredSchema, membershipSchema } from "./metadata";
import { resolveStripeCustomer } from "./resolveStripeCustomer";

export interface SyncStripeChargesResult {
  totalProcessed: number;
  created: number;
  skippedDuplicate: number;
  skippedSelfService: number;
  skippedNoMember: number;
  skippedFailed: number;
  errors: string[];
}

/**
 * Determine the charge type from a Stripe charge by inspecting metadata
 * on the charge itself and, when present, its associated payment intent.
 *
 * Returns undefined if the charge is a self-service "charges" payment
 * (already tracked by the webhook flow).
 */
function resolveChargeType(
  chargeMetadata: Stripe.Metadata,
  piMetadata: Stripe.Metadata | null,
  hasInvoice: boolean,
): ChargeType | undefined {
  // Check payment intent metadata first (more reliable - set by our app)
  const meta = piMetadata ?? chargeMetadata;

  // If metadata.type === "charges", this is a self-service charge payment
  // that's already tracked by the payment_intent.succeeded webhook handler
  if (meta.type === "charges") {
    return undefined;
  }

  // Check for membership metadata
  const membershipResult = membershipSchema.safeParse(meta);
  if (membershipResult.success) {
    return "membership";
  }

  // Check for sponsorship metadata
  const sponsorResult = gameSponsoredSchema.safeParse(meta);
  if (sponsorResult.success) {
    return "sponsorship";
  }

  // Check for explicit type hints
  if (meta.type === "donation") {
    return "donation";
  }

  if (meta.type === "junior_membership") {
    return "junior_membership";
  }

  // If the charge is associated with an invoice, it's from a subscription
  // which means it's a membership payment
  if (hasInvoice) {
    return "membership";
  }

  // Catch-all: unknown charges get imported as "manual"
  return "manual";
}

/**
 * Build a human-readable description for the imported charge.
 */
function buildDescription(
  chargeType: ChargeType,
  piMetadata: Stripe.Metadata | null,
  chargeDescription: string | null,
): string {
  const meta = piMetadata ?? {};

  if (chargeType === "membership") {
    const membershipType = meta.membership;
    if (membershipType) {
      return `Membership payment - ${membershipType}`;
    }
    return "Membership payment";
  }

  if (chargeType === "sponsorship") {
    return "Game sponsorship";
  }

  if (chargeType === "donation") {
    return "Donation";
  }

  if (chargeType === "junior_membership") {
    return "Junior membership payment";
  }

  // For "manual" type, use the Stripe description if available
  return chargeDescription ?? "Stripe payment";
}

/**
 * Sync all historical Stripe charges for members with a stripe_customer_id.
 *
 * For each member:
 * 1. Fetches all charges from Stripe for their customer ID
 * 2. Filters to only succeeded charges
 * 3. Determines the charge type from metadata
 * 4. Creates a charge record if one doesn't already exist (dedup via stripe ID)
 */
export async function syncStripeCharges(): Promise<SyncStripeChargesResult> {
  const result: SyncStripeChargesResult = {
    totalProcessed: 0,
    created: 0,
    skippedDuplicate: 0,
    skippedSelfService: 0,
    skippedNoMember: 0,
    skippedFailed: 0,
    errors: [],
  };

  // Backfill stripe_customer_id for members that don't have one yet.
  // Look up all members without a customer ID, search Stripe by email,
  // and store the match so the charge-fetching loop below can use it.
  const membersWithoutCustomerId = await client
    .selectFrom("member")
    .where("stripe_customer_id", "is", null)
    .select(["id", "email"])
    .execute();

  for (const m of membersWithoutCustomerId) {
    try {
      await resolveStripeCustomer(m.email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(
        `Failed to look up Stripe customer for ${m.email}: ${message}`,
      );
    }
  }

  // Get all members with a stripe_customer_id
  const members = await client
    .selectFrom("member")
    .where("stripe_customer_id", "is not", null)
    .select(["id", "email", "stripe_customer_id"])
    .execute();

  if (members.length === 0) {
    return result;
  }

  for (const member of members) {
    const customerId = member.stripe_customer_id;
    if (!customerId) continue;

    try {
      // Fetch all charges for this customer using auto-pagination
      for await (const charge of stripe.charges.list({
        customer: customerId,
        limit: 100,
        expand: ["data.payment_intent"],
      })) {
        result.totalProcessed++;

        // Only process succeeded charges
        if (charge.status !== "succeeded") {
          result.skippedFailed++;
          continue;
        }

        // Extract payment intent metadata if available
        const pi =
          typeof charge.payment_intent === "object" && charge.payment_intent !== null
            ? charge.payment_intent
            : null;

        const piMetadata = pi?.metadata ?? null;

        // Determine the charge type
        const chargeType = resolveChargeType(
          charge.metadata,
          piMetadata,
          charge.invoice !== null,
        );

        // Skip charges that are self-service payments (already tracked by webhooks)
        if (chargeType === undefined) {
          result.skippedSelfService++;
          continue;
        }

        // Determine the dedup key:
        // - Use payment intent ID when available
        // - Fall back to charge ID (ch_xxx) for legacy charges without PI
        const dedupKey = pi?.id ?? charge.id;

        const description = buildDescription(
          chargeType,
          piMetadata,
          charge.description,
        );

        const chargeResult = await createPaymentCharge({
          memberEmail: member.email,
          description,
          amountPence: charge.amount,
          chargeDate: stripeDate(charge.created),
          type: chargeType,
          source: "historical_import",
          stripePaymentIntentId: dedupKey,
        });

        if (chargeResult.created) {
          result.created++;
        } else if (chargeResult.reason === "duplicate") {
          result.skippedDuplicate++;
        } else if (chargeResult.reason === "no_member") {
          result.skippedNoMember++;
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      result.errors.push(
        `Failed to sync charges for ${member.email} (${customerId}): ${message}`,
      );
    }
  }

  return result;
}
