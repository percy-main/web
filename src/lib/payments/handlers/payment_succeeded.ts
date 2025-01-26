import { type TypeGameFields } from "@/__generated__";
import { match, P } from "ts-pattern";
import { patchEntry } from "../../contentful/patch-entry";
import _ from "lodash/fp";
import { is } from "../metadata";

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
    .otherwise(_.noop);
};
