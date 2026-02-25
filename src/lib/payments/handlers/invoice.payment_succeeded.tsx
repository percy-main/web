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
 * Resolve membership metadata from an invoice event.
 *
 * 1. Check the invoice's own metadata (set for first-time checkout payments).
 * 2. If not found and the invoice is linked to a subscription, retrieve the
 *    subscription from Stripe and check its metadata (covers renewals).
 */
const resolveMembershipMetadata = async (
  invoice: Stripe.Invoice,
): Promise<z.infer<typeof membershipSchema> | undefined> => {
  // Try invoice-level metadata first
  const invoiceParsed = membershipSchema.safeParse(invoice.metadata);
  if (invoiceParsed.success) {
    return invoiceParsed.data;
  }

  // For subscription renewals, metadata lives on the subscription object
  if (invoice.subscription) {
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;

    const subscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    const subscriptionParsed = membershipSchema.safeParse(
      subscription.metadata,
    );
    if (subscriptionParsed.success) {
      return subscriptionParsed.data;
    }
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

  const metadata = await resolveMembershipMetadata(event.data.object);

  if (metadata) {
    const membership = await updateMembership({
      membershipType: metadata.membership,
      email,
      addedDuration: invoiceLinesToDuration(event.data.object.lines.data),
      paidAt: stripeDate(event.created),
    });

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
};
