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
      });

      const match = result_summary.find((r) => r.id.toString() === matchId);
      if (!match) return null;

      const innings = match.innings.map((inn) => {
        const teamId = inn.team_batting_id;
        const isHome = teamId === match.home_team_id;
        const teamName = isHome
          ? `${match.home_club_name} ${match.home_team_name}`
          : `${match.away_club_name} ${match.away_team_name}`;
        const runs = parseInt(inn.runs, 10) || 0;
        const wickets = parseInt(inn.wickets, 10) || 0;

        return {
          teamBattingId: teamId,
          teamName,
          runs,
          wickets,
          overs: inn.overs,
          declared: inn.declared,
          allOut: wickets >= 10,
        };
      });

      const desc = match.result_description.toLowerCase();
      let outcome: "W" | "L" | "D" | "T" | "A" | "C" | "N" | null = null;
      if (desc.includes("abandoned")) outcome = "A";
      else if (desc.includes("cancel")) outcome = "C";
      else if (desc.includes("tied") || match.result === "T") outcome = "T";
      else if (desc.includes("draw") || match.result === "D") outcome = "D";
      else if (desc.includes("no result")) outcome = "N";
      else if (match.result === "W") {
        outcome = match.result_applied_to === ourTeamId ? "W" : "L";
      }

      return {
        outcome,
        description: match.result_description,
        toss: match.toss,
        innings,
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
