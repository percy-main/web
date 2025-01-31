import { updateMembership } from "@/lib/db/service/updateMembership";
import { stripeDate } from "@/lib/util/stripeDate";
import _ from "lodash/fp";
import type Stripe from "stripe";
import { match, P } from "ts-pattern";
import { invoiceLinesToDuration } from "../../util/invoiceLinesToDuration";
import { stripe } from "../client";
import { is } from "../metadata";

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

  await match(event)
    .with(
      { data: { object: { metadata: P.when(is("membership")) } } },
      async ({
        data: {
          object: { metadata },
        },
      }) => {
        await updateMembership({
          membershipType: metadata.membership,
          email,
          addedDuration: invoiceLinesToDuration(event.data.object.lines.data),
          paidAt: stripeDate(event.created),
        });
      },
    )
    .otherwise(_.noop);
};
