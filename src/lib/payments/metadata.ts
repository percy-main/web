import { z } from "astro:schema";
import { isMatching } from "ts-pattern";

export const gameSponsoredSchema = z.object({
  type: z.literal("sponsorGame"),
  gameId: z.string(),
});
export type GameSponsored = z.TypeOf<typeof gameSponsoredSchema>;

export const membershipSchema = z.object({
  type: z.literal("membership"),
});

export const metadata = z.union([
  gameSponsoredSchema,
  membershipSchema,
  z.undefined(),
]);
export type Metadata = z.TypeOf<typeof metadata>;

export const is =
  <const Type extends Exclude<Metadata, undefined>["type"]>(type: Type) =>
  (meta: Metadata): meta is Extract<Metadata, { type: Type }> =>
    isMatching<Partial<Metadata>>({ type })(meta);
