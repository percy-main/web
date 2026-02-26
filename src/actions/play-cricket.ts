import { resolveOutcome, buildInnings } from "@/collections/game";
import * as playCricketApi from "@/lib/play-cricket";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import _ from "lodash";

export const playCricket = {
  getResultSummary: defineAction({
    input: z.object({
      matchId: z.string(),
      season: z.number(),
      ourTeamId: z.string(),
    }),
    handler: async ({ matchId, season, ourTeamId }) => {
      const { result_summary } = await playCricketApi.getResultSummary({
        season,
        teamId: ourTeamId,
      });

      const match = result_summary.find((r) => r.id.toString() === matchId);
      if (!match) return null;

      return {
        outcome: resolveOutcome(match, ourTeamId),
        description: match.result_description,
        toss: match.toss,
        innings: buildInnings(match),
      };
    },
  }),

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
