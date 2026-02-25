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
 * Resolve membership metadata for subscription renewal invoices.
 *
 * For subscription invoices, the metadata lives on the subscription object,
 * not the invoice itself. We retrieve the subscription and check its metadata.
 *
 * NOTE: We intentionally only handle subscription-linked invoices here.
 * Initial subscription payments are handled by checkout.session.completed,
 * and non-subscription invoices don't need this handler. This avoids a
 * double-update where both checkout.session.completed and invoice.payment_succeeded
 * would call updateMembership for the same initial payment.
 */
const resolveRenewalMembershipMetadata = async (
  invoice: Stripe.Invoice,
): Promise<z.infer<typeof membershipSchema> | undefined> => {
  // Only process subscription-linked invoices (renewals)
  if (!invoice.subscription) {
    return undefined;
  }

  // Skip the first invoice of a subscription — checkout.session.completed handles it
  if (invoice.billing_reason === "subscription_create") {
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
      "Failed to retrieve subscription for renewal invoice",
      subscriptionId,
      err,
    );
    throw err;
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

  const metadata = await resolveRenewalMembershipMetadata(event.data.object);

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
