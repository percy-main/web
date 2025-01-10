import { z, defineCollection } from "astro:content";
import { contentClient } from "../lib/contentful/client";
import type { Entry } from "contentful";
import {
  type TypeGameSkeleton,
  type TypeLeagueSkeleton,
  type TypeSponsorSkeleton,
  type TypeTeamSkeleton,
} from "../__generated__";
import * as df from "date-fns";

export const schema = z.object({
  type: z.literal("game"),
  opposition: z.string(),
  home: z.boolean(),
  when: z.date(),
  team: z.string(),
  league: z.string(),
  hasSponsor: z.boolean(),
  sponsor: z
    .object({
      name: z.string(),
      logo: z.string().optional(),
    })
    .optional(),
});

export type Game = z.TypeOf<typeof schema>;

export const loader = async () => {
  const response = await contentClient.getEntries<TypeGameSkeleton>({
    content_type: "game",
  });

  return response.items.map((item) => {
    return {
      id: item.sys.id,
      type: "game",
      opposition: item.fields.opposition,
      home: item.fields.home,
      when: df.parseISO(item.fields.when),
      team: (item.fields.team as Entry<TypeTeamSkeleton>).fields.name,
      league: (item.fields.league as Entry<TypeLeagueSkeleton>).fields.name,
      hasSponsor: item.fields.hasSponsor,
      sponsor: item.fields.sponsor
        ? {
            name: (item.fields.sponsor as Entry<TypeSponsorSkeleton>).fields
              .name,
          }
        : undefined,
    };
  });
};

export const game = defineCollection({
  loader,
  schema,
});
