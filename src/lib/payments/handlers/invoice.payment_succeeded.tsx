import { invoiceLinesToDuration } from "@/lib//util/invoiceLinesToDuration";
import { updateMembership } from "@/lib/db/service/updateMembership";
import { send } from "@/lib/email/send";
import { stripeDate } from "@/lib/util/stripeDate";
import { render } from "@react-email/render";
import { BASE_URL } from "astro:env/client";
import _ from "lodash/fp";
import type Stripe from "stripe";
import { match, P } from "ts-pattern";
import { MembershipCreated } from "~/emails/MembershipUpdated";
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
      },
    )
    .otherwise(_.noop);
};
