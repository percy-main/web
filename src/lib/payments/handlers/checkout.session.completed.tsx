import { createPaymentCharge } from "@/lib/db/service/createPaymentCharge";
import { stripe } from "@/lib/payments/client";
import { send } from "@/lib/email/send";
import { stripeDate } from "@/lib/util/stripeDate";
import { render } from "@react-email/render";
import { BASE_URL } from "astro:env/client";
import _ from "lodash/fp";
import type { Stripe } from "stripe";
import { match, P } from "ts-pattern";

import { MembershipCreated } from "~/emails/MembershipUpdated";
import { updateMembership } from "../../db/service/updateMembership";
import { sendMessage } from "../../slack/sendMessage";
import { invoiceLinesToDuration } from "../../util/invoiceLinesToDuration";
import { is } from "../metadata";

export const checkoutSessionCompleted = async (
  event:
    | Stripe.CheckoutSessionAsyncPaymentSucceededEvent
    | Stripe.CheckoutSessionCompletedEvent,
) => {
  const checkoutSession = await stripe.checkout.sessions.retrieve(
    event.data.object.id,
    {
      expand: ["line_items"],
    },
  );

  // Resolve the payment intent ID from the checkout session
  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;

  await match(checkoutSession)
    .with(
      {
        payment_status: "paid",
        metadata: P.when(is("sponsorGame")),
      },
      async ({ metadata: { gameId }, customer_details, amount_total }) => {
        await sendMessage(`Game ${gameId} was sponsored`);

        const email = customer_details?.email;
        if (email && amount_total) {
          await createPaymentCharge({
            memberEmail: email,
            description: `Game sponsorship`,
            amountPence: amount_total,
            chargeDate: stripeDate(event.created),
            type: "sponsorship",
            source: "webhook",
            stripePaymentIntentId: paymentIntentId,
          });
        }
      },
    )
    .with(
      {
        payment_status: "paid",
        metadata: P.when(is("membership")),
        customer_details: { email: P.string },
        line_items: P.nonNullable,
      },
      async ({
        customer_details: { email },
        line_items,
        metadata,
        amount_total,
      }) => {
        const membership = await updateMembership({
          membershipType: metadata.membership,
          email,
          addedDuration: invoiceLinesToDuration(line_items.data ?? []),
          paidAt: stripeDate(event.created),
        });

        // For subscription-mode checkouts, payment_intent is null — the payment
        // flows through the subscription's invoice. Skip creating the charge here
        // and let payment_intent.succeeded handle it with proper dedup via the PI ID.
        if (amount_total && paymentIntentId) {
          await createPaymentCharge({
            memberEmail: email,
            description: `Membership payment - ${metadata.membership}`,
            amountPence: amount_total,
            chargeDate: stripeDate(event.created),
            type: "membership",
            source: "webhook",
            stripePaymentIntentId: paymentIntentId,
          });
        }

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
