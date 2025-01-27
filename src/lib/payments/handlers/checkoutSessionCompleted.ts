import { stripe } from "@/lib/payments/client";
import { type TypeGameFields } from "@/__generated__";
import { match, P, isMatching } from "ts-pattern";
import { patchEntry } from "@/lib/contentful/patch-entry";
import _ from "lodash/fp";
import { is } from "../metadata";
import * as db from "@/lib/db/client";
import { randomUUID } from "crypto";
import type { Stripe } from "stripe";
import { add, type Duration } from "date-fns";
import { addDurations } from "@/lib/util/addDuration";
import { stripeDate } from "@/lib/util/stripeDate";

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
      ({ metadata: { gameId } }) =>
        patchEntry<TypeGameFields>(gameId, (entry) => !entry.fields.sponsor, [
          { op: "replace", path: "/fields/hasSponsor/en-US", value: true },
        ]),
    )
    .with(
      {
        payment_status: "paid",
        metadata: P.when(is("membership")),
        customer_details: { email: P.string },
        line_items: P.nonNullable,
      },
      async ({ customer_details: { email }, line_items }) => {
        const customer = await db.client
          .selectFrom("member")
          .leftJoin("membership", "member.id", "membership.member_id")
          .select(["member.id as member_id", "membership.id as membership_id"])
          .where("member.email", "=", email)
          .executeTakeFirst();

        if (!customer) {
          throw new Error(`No customer with email: ${email}`);
        }

        const addedMembershipDuration = (line_items.data ?? [])
          .map((li): Duration => {
            // One time member purchases are always for 12 months
            if (li.price?.type === "one_time") {
              return {
                months: 12,
              };
            }

            if (li.price?.recurring?.interval) {
              return {
                [li.price.recurring.interval]:
                  li.price.recurring.interval_count,
              };
            }

            return {
              days: 0,
            };
          })
          .reduce(addDurations, { days: 0 });

        console.log("Adding membership duration", addedMembershipDuration);

        const paid_until = add(
          stripeDate(event.created),
          addedMembershipDuration,
        ).toISOString();

        if (!customer.membership_id) {
          await db.client
            .insertInto("membership")
            .values({
              id: randomUUID(),
              member_id: customer.member_id,
              paid_until,
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();
        }
      },
    )
    .otherwise(_.noop);
};
