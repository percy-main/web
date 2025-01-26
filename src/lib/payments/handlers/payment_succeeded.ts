import { type TypeGameFields } from "@/__generated__";
import { match, P, isMatching } from "ts-pattern";
import { patchEntry } from "@/lib/contentful/patch-entry";
import _ from "lodash/fp";
import { is } from "../metadata";
import * as db from "@/lib/db/client";

export const paymentSucceeded = async (sessionId: string) => {
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

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
      { payment_status: "paid", metadata: P.when(is("membership")) },
      async ({ metadata, customer_email }) => {
        const customer = await db.client
          .selectFrom("membership")
          .leftJoin("user", "email", "email")
          .select(["membership.id", "membership.paid_until"])
          .where("user.email", "=", customer_email)
          .executeTakeFirstOrThrow();
      },
    )
    .otherwise(_.noop);
};
