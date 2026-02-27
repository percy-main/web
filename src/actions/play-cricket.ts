import { resolveOutcome, buildInnings } from "@/collections/game";
import { client } from "@/lib/db/client";
import * as playCricketApi from "@/lib/play-cricket";
import { GetMatchDetailResponse } from "@/lib/play-cricket/schemas";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { format } from "date-fns";
import { sql } from "kysely";
import _ from "lodash";

/** Convert cricket overs string (e.g. "12.3") to total balls */
function oversToBalls(overs: string): number {
  const parts = overs.split(".");
  const completedOvers = parseInt(parts[0], 10) || 0;
  const extraBalls = parseInt(parts[1], 10) || 0;
  return completedOvers * 6 + extraBalls;
}

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
            declared: inn.declared ?? false,
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

  getTeams: defineAction({
    handler: async () => {
      const rows = await client
        .selectFrom("play_cricket_team")
        .select(["id", "name", "is_junior"])
        .execute();

      return {
        teams: rows
          .filter((r): r is typeof r & { id: string } => r.id !== null)
          .map((r) => ({
            id: r.id,
            name: r.name,
            isJunior: r.is_junior === 1,
          })),
      };
    },
  }),

  getLiveScores: defineAction({
    handler: async () => {
      const now = new Date();
      const todayDdMmYyyy = format(now, "dd/MM/yyyy");
      // Cricket season runs April–September; in Jan–Mar, use previous year
      const season =
        now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();

      // Cache the season summary in the DB to avoid hitting the API on every poll
      const SUMMARY_CACHE_KEY = `summary-${season}`;
      const SUMMARY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

      let summaryData: Awaited<
        ReturnType<typeof playCricketApi.getMatchesSummary>
      >;

      const cachedSummary = await client
        .selectFrom("play_cricket_match_cache")
        .select(["data", "fetched_at"])
        .where("match_id", "=", SUMMARY_CACHE_KEY)
        .executeTakeFirst();

      if (
        cachedSummary &&
        Date.now() - new Date(cachedSummary.fetched_at).getTime() <
          SUMMARY_CACHE_TTL_MS
      ) {
        summaryData = JSON.parse(cachedSummary.data) as typeof summaryData;
      } else {
        summaryData = await playCricketApi.getMatchesSummary({ season });
        await client
          .insertInto("play_cricket_match_cache")
          .values({
            match_id: SUMMARY_CACHE_KEY,
            data: JSON.stringify(summaryData),
            fetched_at: new Date().toISOString(),
            match_date: todayDdMmYyyy,
          })
          .onConflict((oc) =>
            oc.column("match_id").doUpdateSet({
              data: JSON.stringify(summaryData),
              fetched_at: new Date().toISOString(),
              match_date: todayDdMmYyyy,
            }),
          )
          .execute();
      }

      const todayMatches = summaryData.matches.filter(
        (m) => m.match_date === todayDdMmYyyy,
      );

      if (todayMatches.length === 0) {
        return { matches: [] };
      }

      const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

      const settled = await Promise.allSettled(
        todayMatches.map(async (summary) => {
          const matchId = summary.id.toString();

          // Check cache
          const cached = await client
            .selectFrom("play_cricket_match_cache")
            .select(["data", "fetched_at"])
            .where("match_id", "=", matchId)
            .executeTakeFirst();

          let detailData: string;
          let fetchedAt: string;

          if (
            cached &&
            Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS
          ) {
            detailData = cached.data;
            fetchedAt = cached.fetched_at;
          } else {
            // Fetch fresh from Play-Cricket API
            const detail = await playCricketApi.getMatchDetail({
              matchId,
            });
            detailData = JSON.stringify(detail);
            fetchedAt = new Date().toISOString();

            // Upsert cache
            await client
              .insertInto("play_cricket_match_cache")
              .values({
                match_id: matchId,
                data: detailData,
                fetched_at: fetchedAt,
                match_date: todayDdMmYyyy,
              })
              .onConflict((oc) =>
                oc.column("match_id").doUpdateSet({
                  data: detailData,
                  fetched_at: fetchedAt,
                  match_date: todayDdMmYyyy,
                }),
              )
              .execute();
          }

          const parsed = GetMatchDetailResponse.parse(JSON.parse(detailData));
          const match = parsed.match_details[0];

          if (!match) return null;

          // Determine status — innings.length > 0 means play has started
          const hasInningsData = match.innings.length > 0;
          const hasResult = !!match.result && match.result !== "";

          let status: "not_started" | "in_progress" | "completed";
          if (hasResult) {
            status = "completed";
          } else if (hasInningsData) {
            status = "in_progress";
          } else {
            status = "not_started";
          }

          return {
            matchId,
            homeTeam: `${match.home_club_name} ${match.home_team_name}`,
            homeTeamId: match.home_team_id,
            awayTeam: `${match.away_club_name} ${match.away_team_name}`,
            awayTeamId: match.away_team_id,
            matchDate: summary.match_date,
            matchTime: summary.match_time,
            status,
            toss: match.toss || null,
            battedFirst: match.batted_first || null,
            result: match.result_description || null,
            resultAppliedTo: match.result_applied_to || null,
            innings: match.innings.map((inn) => ({
              teamBattingName: inn.team_batting_name,
              teamBattingId: inn.team_batting_id,
              inningsNumber: inn.innings_number,
              runs: parseInt(inn.runs, 10) || 0,
              wickets: parseInt(inn.wickets, 10) || 0,
              overs: inn.overs,
              declared: inn.declared ?? false,
            })),
            lastUpdatedAt: fetchedAt,
          };
        }),
      );

      const results = settled
        .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return { matches: results };
    },
  }),

  getPlayerCareerStats: defineAction({
    input: z.object({
      contentfulEntryId: z.string(),
    }),
    handler: async ({ contentfulEntryId }) => {
      const member = await client
        .selectFrom("member")
        .select(["id", "name", "play_cricket_id"])
        .where("contentful_entry_id", "=", contentfulEntryId)
        .executeTakeFirst();

      if (!member?.play_cricket_id) {
        return null;
      }

      const playerId = member.play_cricket_id;

      // Run independent queries in parallel
      const [
        battingSeasons,
        bowlingSeasons,
        battingTotals,
        bowlingTotals,
        bestBowling,
        matchCountResult,
      ] = await Promise.all([
        // Available seasons from batting
        client
          .selectFrom("match_performance_batting")
          .select("season")
          .where("player_id", "=", playerId)
          .groupBy("season")
          .execute(),
        // Available seasons from bowling
        client
          .selectFrom("match_performance_bowling")
          .select("season")
          .where("player_id", "=", playerId)
          .groupBy("season")
          .execute(),
        // All-time batting totals
        client
          .selectFrom("match_performance_batting")
          .select([
            sql<number>`SUM(runs)`.as("total_runs"),
            sql<number>`COUNT(*)`.as("total_innings"),
            sql<number>`MAX(runs)`.as("high_score"),
          ])
          .where("player_id", "=", playerId)
          .executeTakeFirst(),
        // All-time bowling totals
        client
          .selectFrom("match_performance_bowling")
          .select([
            sql<number>`SUM(wickets)`.as("total_wickets"),
          ])
          .where("player_id", "=", playerId)
          .executeTakeFirst(),
        // Best bowling: highest wickets, ties broken by lowest runs, then fewest balls
        client
          .selectFrom("match_performance_bowling")
          .select(["wickets", "runs", "overs"])
          .where("player_id", "=", playerId)
          .where("wickets", ">", 0)
          .orderBy("wickets", "desc")
          .orderBy("runs", "asc")
          .orderBy(
            sql`(CAST(SUBSTR(overs, 1, INSTR(overs, '.') - 1) AS INTEGER) * 6 + CAST(SUBSTR(overs, INSTR(overs, '.') + 1) AS INTEGER))`,
            "asc",
          )
          .limit(1)
          .executeTakeFirst(),
        // Total distinct matches via SQL UNION
        sql<{ count: number }>`
          SELECT COUNT(*) as count FROM (
            SELECT match_id FROM match_performance_batting WHERE player_id = ${playerId}
            UNION
            SELECT match_id FROM match_performance_bowling WHERE player_id = ${playerId}
          )
        `.execute(client),
      ]);

      const seasons = [
        ...new Set([
          ...battingSeasons.map((r) => r.season),
          ...bowlingSeasons.map((r) => r.season),
        ]),
      ].sort((a, b) => b - a);

      if (seasons.length === 0) {
        return { seasons: [], career: null };
      }

      const totalMatches = matchCountResult.rows[0]?.count ?? 0;

      return {
        seasons,
        career: {
          matches: totalMatches,
          runs: battingTotals?.total_runs ?? 0,
          wickets: bowlingTotals?.total_wickets ?? 0,
          highScore: battingTotals?.high_score ?? null,
          bestBowling: bestBowling
            ? `${bestBowling.wickets}/${bestBowling.runs}`
            : null,
        },
      };
    },
  }),

  getPlayerSeasonStats: defineAction({
    input: z.object({
      contentfulEntryId: z.string(),
      season: z.number(),
    }),
    handler: async ({ contentfulEntryId, season }) => {
      // Find the member with this contentful entry ID
      const member = await client
        .selectFrom("member")
        .select(["id", "name", "play_cricket_id"])
        .where("contentful_entry_id", "=", contentfulEntryId)
        .executeTakeFirst();

      if (!member?.play_cricket_id) {
        return null;
      }

      const playerId = member.play_cricket_id;

      // Fetch batting stats
      const battingRows = await client
        .selectFrom("match_performance_batting as b")
        .select([
          sql<number>`SUM(b.runs)`.as("total_runs"),
          sql<number>`COUNT(*)`.as("innings"),
          sql<number>`SUM(b.not_out)`.as("not_outs"),
          sql<number>`MAX(b.runs)`.as("high_score"),
          sql<number>`SUM(b.balls)`.as("total_balls"),
          sql<number>`SUM(b.fours)`.as("total_fours"),
          sql<number>`SUM(b.sixes)`.as("total_sixes"),
          sql<number>`SUM(CASE WHEN b.runs >= 50 AND b.runs < 100 THEN 1 ELSE 0 END)`.as(
            "fifties",
          ),
          sql<number>`SUM(CASE WHEN b.runs >= 100 THEN 1 ELSE 0 END)`.as(
            "hundreds",
          ),
        ])
        .where("b.player_id", "=", playerId)
        .where("b.season", "=", season)
        .executeTakeFirst();

      // Fetch bowling stats
      const bowlingRows = await client
        .selectFrom("match_performance_bowling as b")
        .select([
          sql<number>`COUNT(*)`.as("matches"),
          sql<number>`SUM(b.wickets)`.as("total_wickets"),
          sql<number>`SUM(b.runs)`.as("total_runs"),
          sql<number>`SUM(b.maidens)`.as("total_maidens"),
        ])
        .where("b.player_id", "=", playerId)
        .where("b.season", "=", season)
        .executeTakeFirst();

      // Compute bowling overs + best bowling spell
      let totalBowlingBalls = 0;
      let bestBowlingSpell: { wickets: number; runs: number } | null = null;
      if (bowlingRows && bowlingRows.matches > 0) {
        const [oversRows, bestSpell] = await Promise.all([
          client
            .selectFrom("match_performance_bowling as b")
            .select(["b.overs"])
            .where("b.player_id", "=", playerId)
            .where("b.season", "=", season)
            .execute(),
          client
            .selectFrom("match_performance_bowling as b")
            .select(["b.wickets", "b.runs"])
            .where("b.player_id", "=", playerId)
            .where("b.season", "=", season)
            .where("b.wickets", ">", 0)
            .orderBy("b.wickets", "desc")
            .orderBy("b.runs", "asc")
            .limit(1)
            .executeTakeFirst(),
        ]);

        for (const row of oversRows) {
          totalBowlingBalls += oversToBalls(row.overs);
        }
        bestBowlingSpell = bestSpell ?? null;
      }

      const hasBatting = battingRows && battingRows.innings > 0;
      const hasBowling = bowlingRows && bowlingRows.matches > 0;

      if (!hasBatting && !hasBowling) {
        return null;
      }

      const batting = hasBatting
        ? (() => {
            const dismissals = battingRows.innings - battingRows.not_outs;
            const average =
              dismissals > 0 ? battingRows.total_runs / dismissals : null;
            const strikeRate =
              battingRows.total_balls > 0
                ? (battingRows.total_runs / battingRows.total_balls) * 100
                : null;
            return {
              innings: battingRows.innings,
              notOuts: battingRows.not_outs,
              runs: battingRows.total_runs,
              highScore: battingRows.high_score,
              average:
                average !== null && battingRows.innings >= 3
                  ? Math.round(average * 100) / 100
                  : null,
              strikeRate:
                strikeRate !== null
                  ? Math.round(strikeRate * 100) / 100
                  : null,
              fours: battingRows.total_fours,
              sixes: battingRows.total_sixes,
              fifties: battingRows.fifties,
              hundreds: battingRows.hundreds,
            };
          })()
        : null;

      const bowling = hasBowling
        ? (() => {
            const totalOvers = Math.floor(totalBowlingBalls / 6);
            const remainingBalls = totalBowlingBalls % 6;
            const oversStr = `${totalOvers}.${remainingBalls}`;
            const average =
              bowlingRows.total_wickets > 0
                ? bowlingRows.total_runs / bowlingRows.total_wickets
                : null;
            const economy =
              totalBowlingBalls > 0
                ? bowlingRows.total_runs / (totalBowlingBalls / 6)
                : null;
            const strikeRate =
              bowlingRows.total_wickets > 0
                ? totalBowlingBalls / bowlingRows.total_wickets
                : null;
            return {
              matches: bowlingRows.matches,
              overs: oversStr,
              maidens: bowlingRows.total_maidens,
              runs: bowlingRows.total_runs,
              wickets: bowlingRows.total_wickets,
              average:
                average !== null && totalBowlingBalls >= 60
                  ? Math.round(average * 100) / 100
                  : null,
              economy:
                economy !== null
                  ? Math.round(economy * 100) / 100
                  : null,
              strikeRate:
                strikeRate !== null && totalBowlingBalls >= 60
                  ? Math.round(strikeRate * 10) / 10
                  : null,
              bestBowling: bestBowlingSpell
                ? `${bestBowlingSpell.wickets}/${bestBowlingSpell.runs}`
                : null,
            };
          })()
        : null;

      return {
        playerName: member.name,
        season,
        batting,
        bowling,
      };
    },
  }),
};
