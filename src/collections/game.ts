import { z, defineCollection } from "astro:content";
import { client } from "../lib/contentful/client";
import type { Entry, EntrySkeletonType } from "contentful";
import {
  isTypePage,
  type TypeGameSkeleton,
  type TypeLeagueSkeleton,
  type TypePage,
  type TypePageSkeleton,
  type TypeTeamSkeleton,
} from "../__generated__";
import * as df from "date-fns";

const gameSchema = z.object({
  opposition: z.string(),
  home: z.boolean(),
  when: z.date(),
  team: z.string(),
  league: z.string(),
});

export type Game = z.TypeOf<typeof gameSchema>;

export const game = defineCollection({
  loader: async () => {
    const response = await client.getEntries<TypeGameSkeleton>({
      content_type: "game",
    });

    return response.items.map((item) => {
      return {
        id: item.sys.id,
        opposition: item.fields.opposition,
        home: item.fields.home,
        when: df.parseISO(item.fields.when),
        team: (item.fields.team as Entry<TypeTeamSkeleton>).fields.name,
        league: (item.fields.league as Entry<TypeLeagueSkeleton>).fields.name,
      };
    });
  },
  schema: gameSchema,
});
