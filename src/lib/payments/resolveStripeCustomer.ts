import { client } from "@/lib/db/client";
import { stripe } from "./client";

/**
 * Find or create a Stripe customer for the given email, and optionally
 * link it to the member record in the database.
 *
 * Returns the Stripe customer ID, or undefined if no email was provided.
 */
export async function resolveStripeCustomer(
  email: string | undefined,
): Promise<string | undefined> {
  if (!email) return undefined;

  const existing = await stripe.customers.list({ email, limit: 1 });
  const customer =
    existing.data.length > 0
      ? existing.data[0]
      : await stripe.customers.create({ email });

  // Best-effort: link to member record if one exists and doesn't already have a customer ID
  await client
    .updateTable("member")
    .set({ stripe_customer_id: customer.id })
    .where("email", "=", email)
    .where("stripe_customer_id", "is", null)
    .execute();

  return customer.id;
}
