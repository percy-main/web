import { type TypeGameFields } from "@/__generated__";
import { match, P } from "ts-pattern";
import { patchEntry } from "../../contentful/patch-entry";
import _ from "lodash/fp";
import { z } from "astro:schema";

export const gameSponsoredSchema = z.object({
  type: z.literal("sponsorGame"),
  gameId: z.string(),
});
export type GameSponsored = z.TypeOf<typeof gameSponsoredSchema>;

export const membershipSchema = z.object({
  type: z.literal("membership"),
});

export const metadata = z.union([gameSponsoredSchema, membershipSchema]);
export type Metadata = z.TypeOf<typeof metadata>;

const is =
  <T extends Metadata>(fn: (a: Metadata) => a is T) =>
  (cand: Metadata): cand is T =>
    fn(cand);

const gameSponsored = (meta: Metadata): meta is GameSponsored =>
  meta.type === "sponsorGame";

export const paymentSucceeded = async (sessionId: string) => {
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  await match(checkoutSession)
    .with(
      {
        payment_status: "paid",
        metadata: P.when(is(gameSponsored)),
      },
      ({ metadata: { gameId } }) =>
        patchEntry<TypeGameFields>(gameId, (entry) => !entry.fields.sponsor, [
          { op: "replace", path: "/fields/hasSponsor/en-US", value: true },
        ]),
    )
    .otherwise(_.noop);
};
