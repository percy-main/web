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
        const membership = await updateMembership({
          membershipType: metadata.membership,
          email,
          addedDuration: invoiceLinesToDuration(line_items.data ?? []),
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
