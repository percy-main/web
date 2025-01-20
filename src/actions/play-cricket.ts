import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import * as playCricketApi from "@/lib/play-cricket";
import _ from "lodash";

export const playCricket = {
  getLeagueTable: defineAction({
    input: z.object({
      divisionId: z.string(),
    }),
    handler: async ({ divisionId }) => {
      const {
        league_table: [league_table],
      } = await playCricketApi.getLeagueTable({
        divisionId,
      });

      const columns = Object.values(league_table.headings);

      const rows = league_table.values.map(
        ({ position, team_id, ...team }) =>
          ({
            position,
            team_id,
            ...Object.fromEntries(_.zip(columns, Object.values(team))),
          }) as { position: string; team_id: string } & Record<string, string>,
      );

      const response = {
        id: league_table.id,
        name: league_table.name,
        columns,
        rows,
      };

      return response;
    },
  }),
};
