import { stripe } from "@/lib/payments/client";
import { stripeDate } from "@/lib/util/stripeDate";
import _ from "lodash/fp";
import type { Stripe } from "stripe";
import { match, P } from "ts-pattern";
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

  await match(checkoutSession)
    .with(
      {
        payment_status: "paid",
        metadata: P.when(is("sponsorGame")),
      },
      ({ metadata: { gameId } }) => sendMessage(`Game ${gameId} was sponsored`),
    )
    .with(
      {
        payment_status: "paid",
        metadata: P.when(is("membership")),
        customer_details: { email: P.string },
        line_items: P.nonNullable,
      },
      async ({ customer_details: { email }, line_items, metadata }) => {
        await updateMembership({
          membershipType: metadata.membership,
          email,
          addedDuration: invoiceLinesToDuration(line_items.data ?? []),
          paidAt: stripeDate(event.created),
        });
      },
    )
    .otherwise(_.noop);
};
