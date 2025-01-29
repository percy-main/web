import { type TypeGameFields } from "@/__generated__";
import { patchEntry } from "@/lib/contentful/patch-entry";
import * as db from "@/lib/db/client";
import { stripe } from "@/lib/payments/client";
import { addDurations } from "@/lib/util/addDuration";
import { stripeDate } from "@/lib/util/stripeDate";
import { randomUUID } from "crypto";
import { add, type Duration } from "date-fns";
import _ from "lodash/fp";
import type { Stripe } from "stripe";
import { match, P } from "ts-pattern";
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
      async ({ customer_details: { email }, line_items, metadata }) => {
        const customer = await db.client
          .selectFrom("member")
          .leftJoin("membership", (join) =>
            join
              .onRef("member.id", "=", "membership.member_id")
              .on("membership.type", "=", metadata.membership),
          )
          .select([
            "member.id as member_id",
            "membership.id as membership_id",
            "membership.paid_until as paid_until",
          ])
          .where("member.email", "=", email)
          .executeTakeFirst();

        if (!customer) {
          console.log(`No customer with email`, { email });
          return;
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

        if (!customer.membership_id) {
          console.log(
            "No existing membership for customer, creating membership ",
          );

          const paid_until = add(
            stripeDate(event.created),
            addedMembershipDuration,
          ).toISOString();

          await db.client
            .insertInto("membership")
            .values({
              id: randomUUID(),
              type: metadata.membership,
              member_id: customer.member_id,
              paid_until,
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();
        } else {
          console.log(
            "Existing membership for customer, adding duration to previous paid_until ",
          );

          const paid_until = add(
            customer.paid_until
              ? new Date(customer.paid_until)
              : stripeDate(event.created),
            addedMembershipDuration,
          ).toISOString();

          await db.client
            .updateTable("membership")
            .set({
              paid_until,
            })
            .where("id", "=", customer.membership_id)
            .execute();
        }
      },
    )
    .otherwise(_.noop);
};
