import { invoiceLinesToDuration } from "@/lib//util/invoiceLinesToDuration";
import { updateMembership } from "@/lib/db/service/updateMembership";
import { send } from "@/lib/email/send";
import { stripeDate } from "@/lib/util/stripeDate";
import { render } from "@react-email/render";
import { BASE_URL } from "astro:env/client";
import type Stripe from "stripe";
import { z } from "astro:schema";
import { MembershipCreated } from "~/emails/MembershipUpdated";
import { stripe } from "../client";
import { membershipSchema } from "../metadata";

/**
 * Resolve membership metadata from a subscription invoice.
 *
 * For subscription invoices, the metadata lives on the subscription object,
 * not the invoice itself. We retrieve the subscription and check its metadata.
 *
 * Handles both:
 * - Initial subscription invoices (billing_reason: subscription_create) created
 *   via the direct subscription flow (source: "direct" in metadata)
 * - Renewal invoices (billing_reason: subscription_cycle)
 *
 * Skips initial invoices for checkout-created subscriptions — those are handled
 * by checkout.session.completed (legacy flow, kept for backward compatibility).
 */
const resolveSubscriptionMembershipMetadata = async (
  invoice: Stripe.Invoice,
): Promise<z.infer<typeof membershipSchema> | undefined> => {
  if (!invoice.subscription) {
    return undefined;
  }

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id;

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    console.error(
      "Failed to retrieve subscription for invoice",
      subscriptionId,
      err,
    );
    throw err;
  }

  // Skip initial invoices for checkout-created subscriptions
  // (those are handled by checkout.session.completed)
  if (
    invoice.billing_reason === "subscription_create" &&
    subscription.metadata.source !== "direct"
  ) {
    return undefined;
  }

  const parsed = membershipSchema.safeParse(subscription.metadata);
  if (parsed.success) {
    return parsed.data;
  }

  return undefined;
};

export const invoicePaymentSucceeded = async (
  event: Stripe.InvoicePaymentSucceededEvent,
) => {
  const customer =
    typeof event.data.object.customer === "string"
      ? await stripe.customers.retrieve(event.data.object.customer)
      : event.data.object.customer;

  if (customer == null) {
    console.error("Missing customer", event.data.object.customer);
    throw new Error("Missing customer");
  }

  if (customer.deleted) {
    console.error("Deleted customer", event.data.object.customer);
    throw new Error("Deleted customer");
  }

  const { email } = customer;

  if (email == null) {
    console.error("Customer missing email", event.data.object.customer);
    throw new Error("Customer missing email");
  }

  const metadata = await resolveSubscriptionMembershipMetadata(
    event.data.object,
  );

  if (metadata) {
    const membership = await updateMembership({
      membershipType: metadata.membership,
      email,
      addedDuration: invoiceLinesToDuration(event.data.object.lines.data),
      paidAt: stripeDate(event.created),
    });

    // Send confirmation email for initial subscription payments
    if (event.data.object.billing_reason === "subscription_create") {
      await send({
        to: email,
        subject: MembershipCreated.subject,
        html: await render(
          <MembershipCreated.component
            imageBaseUrl={`${BASE_URL}/images`}
            name={membership.name}
            type={membership.type ?? undefined}
            paid_until={membership.paid_until}
            isNew={membership.isNew}
          />,
          {
            pretty: true,
          },
        ),
      });
    }
  }
};
