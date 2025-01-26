import { z } from "astro:schema";

export const gameSponsoredSchema = z.object({
  type: z.literal("sponsorGame"),
  gameId: z.string(),
});
export type GameSponsored = z.TypeOf<typeof gameSponsoredSchema>;

export const membershipSchema = z.object({
  type: z.literal("membership"),
});

export const metadata = z
  .union([gameSponsoredSchema, membershipSchema, z.object({})])
  .optional();
export type Metadata = z.TypeOf<typeof metadata>;

export const is =
  <Type>(type: Type) =>
  (meta: Metadata): meta is Extract<Metadata, { type: Type }> =>
    meta && "type" in meta && meta.type === type ? true : false;
