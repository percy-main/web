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

  getMatchDetail: defineAction({
    input: z.object({
      matchId: z.string(),
    }),
    handler: async ({ matchId }) => {
      const { match_details } = await playCricketApi.getMatchDetail({
        matchId,
      });
      const match = match_details[0];
      if (!match) return null;

      return {
        homeTeamName: `${match.home_club_name} ${match.home_team_name}`,
        homeTeamId: match.home_team_id,
        awayTeamName: `${match.away_club_name} ${match.away_team_name}`,
        awayTeamId: match.away_team_id,
        toss: match.toss,
        result: match.result,
        resultDescription: match.result_description,
        resultAppliedTo: match.result_applied_to,
        battedFirst: match.batted_first,
        innings: match.innings.map((inn) => ({
          teamBattingName: inn.team_batting_name,
          teamBattingId: inn.team_batting_id,
          inningsNumber: inn.innings_number,
          batting: inn.bat.map((b) => ({
            position: parseInt(b.position, 10) || 0,
            name: b.batsman_name,
            id: b.batsman_id,
            howOut: b.how_out,
            fielderName: b.fielder_name,
            bowlerName: b.bowler_name,
            runs: parseInt(b.runs, 10) || 0,
            balls: parseInt(b.balls, 10) || 0,
            fours: parseInt(b.fours, 10) || 0,
            sixes: parseInt(b.sixes, 10) || 0,
          })),
          bowling: inn.bowl.map((b) => ({
            name: b.bowler_name,
            id: b.bowler_id,
            overs: b.overs,
            maidens: parseInt(b.maidens, 10) || 0,
            runs: parseInt(b.runs, 10) || 0,
            wickets: parseInt(b.wickets, 10) || 0,
            wides: parseInt(b.wides, 10) || 0,
            noBalls: parseInt(b.no_balls, 10) || 0,
          })),
          fallOfWickets: inn.fow.map((f) => ({
            wicketNumber: f.wickets,
            runs: parseInt(f.runs, 10) || 0,
            batsmanOutName: f.batsman_out_name,
          })),
          extras: {
            byes: parseInt(inn.extra_byes, 10) || 0,
            legByes: parseInt(inn.extra_leg_byes, 10) || 0,
            wides: parseInt(inn.extra_wides, 10) || 0,
            noBalls: parseInt(inn.extra_no_balls, 10) || 0,
            penalties: parseInt(inn.extra_penalty_runs, 10) || 0,
            total: parseInt(inn.total_extras, 10) || 0,
          },
          total: {
            runs: parseInt(inn.runs, 10) || 0,
            wickets: parseInt(inn.wickets, 10) || 0,
            overs: inn.overs,
            declared: inn.declared,
          },
        })),
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
