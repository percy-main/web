import { client } from "@/lib/db/client";
import type { LiveLoader } from "astro/loaders";
import { sql } from "kysely";

/** Convert cricket overs string (e.g. "12.3") to total balls */
function oversToBalls(overs: string): number {
  const parts = overs.split(".");
  const completedOvers = parseInt(parts[0], 10) || 0;
  const extraBalls = parseInt(parts[1], 10) || 0;
  return completedOvers * 6 + extraBalls;
}

interface CareerStats {
  matches: number;
  runs: number;
  wickets: number;
  highScore: number | null;
  bestBowling: string | null;
}

interface BattingStats {
  innings: number;
  notOuts: number;
  runs: number;
  highScore: number;
  average: number | null;
  strikeRate: number | null;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
}

interface BowlingStats {
  matches: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  average: number | null;
  economy: number | null;
  strikeRate: number | null;
  bestBowling: string | null;
}

export interface PersonStats {
  [key: string]: unknown;
  seasons: number[];
  career: CareerStats | null;
  initialSeason: number | null;
  initialSeasonBatting: BattingStats | null;
  initialSeasonBowling: BowlingStats | null;
  playerName: string | null;
}

interface EntryFilter {
  id: string;
}

async function getCareerStats(playerId: string) {
  const [
    battingSeasons,
    bowlingSeasons,
    battingTotals,
    bowlingTotals,
    bestBowling,
    matchCountResult,
  ] = await Promise.all([
    client
      .selectFrom("match_performance_batting")
      .select("season")
      .where("player_id", "=", playerId)
      .groupBy("season")
      .execute(),
    client
      .selectFrom("match_performance_bowling")
      .select("season")
      .where("player_id", "=", playerId)
      .groupBy("season")
      .execute(),
    client
      .selectFrom("match_performance_batting")
      .select([
        sql<number>`SUM(runs)`.as("total_runs"),
        sql<number>`COUNT(*)`.as("total_innings"),
        sql<number>`MAX(runs)`.as("high_score"),
      ])
      .where("player_id", "=", playerId)
      .executeTakeFirst(),
    client
      .selectFrom("match_performance_bowling")
      .select([sql<number>`SUM(wickets)`.as("total_wickets")])
      .where("player_id", "=", playerId)
      .executeTakeFirst(),
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
}

async function getSeasonStats(playerId: string, season: number) {
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

  let batting: BattingStats | null = null;
  if (hasBatting) {
    const dismissals = battingRows.innings - battingRows.not_outs;
    const average =
      dismissals > 0 ? battingRows.total_runs / dismissals : null;
    const strikeRate =
      battingRows.total_balls > 0
        ? (battingRows.total_runs / battingRows.total_balls) * 100
        : null;
    batting = {
      innings: battingRows.innings,
      notOuts: battingRows.not_outs,
      runs: battingRows.total_runs,
      highScore: battingRows.high_score,
      average:
        average !== null && battingRows.innings >= 3
          ? Math.round(average * 100) / 100
          : null,
      strikeRate:
        strikeRate !== null ? Math.round(strikeRate * 100) / 100 : null,
      fours: battingRows.total_fours,
      sixes: battingRows.total_sixes,
      fifties: battingRows.fifties,
      hundreds: battingRows.hundreds,
    };
  }

  let bowling: BowlingStats | null = null;
  if (hasBowling) {
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
    bowling = {
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
        economy !== null ? Math.round(economy * 100) / 100 : null,
      strikeRate:
        strikeRate !== null && totalBowlingBalls >= 60
          ? Math.round(strikeRate * 10) / 10
          : null,
      bestBowling: bestBowlingSpell
        ? `${bestBowlingSpell.wickets}/${bestBowlingSpell.runs}`
        : null,
    };
  }

  return { batting, bowling };
}

export function personStatsLoader(): LiveLoader<
  PersonStats,
  EntryFilter
> {
  return {
    name: "person-stats-loader",
    loadCollection: () => {
      // Not used — stats are always loaded per-entry via getLiveEntry
      return Promise.resolve({ entries: [] });
    },
    loadEntry: async ({ filter }) => {
      const contentfulEntryId = filter.id;

      const member = await client
        .selectFrom("member")
        .select(["id", "name", "play_cricket_id"])
        .where("contentful_entry_id", "=", contentfulEntryId)
        .executeTakeFirst();

      if (!member?.play_cricket_id) {
        return {
          id: contentfulEntryId,
          data: {
            seasons: [],
            career: null,
            initialSeason: null,
            initialSeasonBatting: null,
            initialSeasonBowling: null,
            playerName: null,
          },
        };
      }

      const { seasons, career } = await getCareerStats(member.play_cricket_id);

      let initialSeason: number | null = null;
      let initialSeasonBatting: BattingStats | null = null;
      let initialSeasonBowling: BowlingStats | null = null;

      if (seasons.length > 0) {
        initialSeason = seasons[0];
        const seasonData = await getSeasonStats(
          member.play_cricket_id,
          initialSeason,
        );
        initialSeasonBatting = seasonData.batting;
        initialSeasonBowling = seasonData.bowling;
      }

      return {
        id: contentfulEntryId,
        data: {
          seasons,
          career,
          initialSeason,
          initialSeasonBatting,
          initialSeasonBowling,
          playerName: member.name,
        },
      };
    },
  };
}
