import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import { calculateFantasyScores } from "@/lib/fantasy/calculate-scores";
import {
  getCurrentGameweek,
  getCurrentSeason,
  getGW1StartDate,
  getTransferWindowInfo,
  isGameweekLocked,
  isPreSeason,
  MAX_TRANSFERS_PER_GAMEWEEK,
} from "@/lib/fantasy/gameweek";
import { calculateSlotEffectivePoints } from "@/lib/fantasy/calculate-scores";
import {
  calculateBattingPoints,
  calculateBowlingPoints,
  calculateFieldingPoints,
  CHAOS_RULE_TYPES,
  CHIPS,
  CHIP_TYPES,
  type ChipType,
  ELIGIBLE_TEAM_IDS,
  LEAGUE_COMPETITION_TYPES,
  SANDWICH_BUDGET,
  SCORING,
  SLOT_COUNTS,
  type SlotType,
} from "@/lib/fantasy/scoring";
import { send } from "@/lib/email/send";
import { render } from "@react-email/components";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { sql } from "kysely";
import { createElement } from "react";
import { ChaosWeekAnnouncement } from "../../emails/ChaosWeekAnnouncement";

/**
 * kysely-codegen generates integer PKs as `number | null` for SQLite.
 * This helper safely extracts a non-null id from a row.
 */
function requireId(id: number | null): number {
  if (id === null) throw new Error("Expected non-null id");
  return id;
}

/**
 * Assign standard competition ranking (1224) to sorted entries.
 * Entries with the same score get the same rank.
 */
function assignRanks<T>(
  entries: T[],
  getScore: (entry: T) => number,
): Array<T & { rank: number }> {
  let currentRank = 1;
  return entries.map((entry, i) => {
    const prev = entries[i - 1];
    if (i > 0 && prev !== undefined && getScore(entry) < getScore(prev)) {
      currentRank = i + 1;
    }
    return { ...entry, rank: currentRank };
  });
}

// ---------------------------------------------------------------------------
// Ownership helpers
// ---------------------------------------------------------------------------

type OwnershipEntry = {
  ownerCount: number;
  captainCount: number;
  ownershipPct: number;
  captainPct: number;
};

async function getOwnershipData(
  season: string,
  gameweek: number,
): Promise<{ ownershipMap: Map<string, OwnershipEntry>; teamCount: number }> {
  const playerOwnership = await client
    .selectFrom("fantasy_team_player as ftp")
    .innerJoin("fantasy_team as ft", "ft.id", "ftp.fantasy_team_id")
    .where("ft.season", "=", season)
    .where("ftp.gameweek_added", "<=", gameweek)
    .where((eb) =>
      eb.or([
        eb("ftp.gameweek_removed", "is", null),
        eb("ftp.gameweek_removed", ">", gameweek),
      ]),
    )
    .select([
      "ftp.play_cricket_id",
      sql<number>`COUNT(DISTINCT ftp.fantasy_team_id)`.as("owner_count"),
      sql<number>`COUNT(DISTINCT CASE WHEN ftp.is_captain = 1 THEN ftp.fantasy_team_id END)`.as(
        "captain_count",
      ),
    ])
    .groupBy("ftp.play_cricket_id")
    .execute();

  const totalTeams = await client
    .selectFrom("fantasy_team")
    .where("season", "=", season)
    .select(sql<number>`COUNT(*)`.as("count"))
    .executeTakeFirst();

  const teamCount = totalTeams?.count ?? 0;

  const ownershipMap = new Map<string, OwnershipEntry>();
  for (const row of playerOwnership) {
    ownershipMap.set(row.play_cricket_id, {
      ownerCount: row.owner_count,
      captainCount: row.captain_count,
      ownershipPct: teamCount > 0 ? Math.round((row.owner_count / teamCount) * 100) : 0,
      captainPct: teamCount > 0 ? Math.round((row.captain_count / teamCount) * 100) : 0,
    });
  }

  return { ownershipMap, teamCount };
}

function getDifferentialThreshold(teamCount: number): number {
  return Math.max(10, Math.min(20, 30 - teamCount));
}

/**
 * Find the best differential picks: low-ownership players with high points.
 * Uses a "differential value" score = points * (1 - ownershipPct/100)
 * so a 50pt player at 10% ownership beats a 40pt player at 10%.
 */
function rankDifferentials(
  ownershipMap: Map<string, OwnershipEntry>,
  teamCount: number,
  pointsMap: Map<string, { playerName: string; points: number }>,
  limit: number,
  costMap?: Map<string, number>,
): Array<{ playCricketId: string; playerName: string; points: number; ownershipPct: number; sandwichCost: number }> {
  const threshold = getDifferentialThreshold(teamCount);

  const candidates: Array<{
    playCricketId: string;
    playerName: string;
    points: number;
    ownershipPct: number;
    sandwichCost: number;
    diffValue: number;
  }> = [];

  for (const [id, entry] of ownershipMap) {
    if (entry.ownershipPct <= 0 || entry.ownershipPct > threshold) continue;
    const pts = pointsMap.get(id);
    if (!pts || pts.points <= 0) continue;
    candidates.push({
      playCricketId: id,
      playerName: pts.playerName,
      points: pts.points,
      ownershipPct: entry.ownershipPct,
      sandwichCost: costMap?.get(id) ?? 0,
      diffValue: pts.points * (1 - entry.ownershipPct / 100),
    });
  }

  return candidates
    .sort((a, b) => b.diffValue - a.diffValue || a.ownershipPct - b.ownershipPct)
    .slice(0, limit)
    .map(({ playCricketId, playerName, points, ownershipPct, sandwichCost }) => ({
      playCricketId,
      playerName,
      points,
      ownershipPct,
      sandwichCost,
    }));
}

// ---------------------------------------------------------------------------
// Points calculation from raw match data
// ---------------------------------------------------------------------------

type SeasonPoints = { totalPoints: number; matchesPlayed: number };

/**
 * Calculate fantasy points per player for one or more seasons using raw
 * match performance data and the scoring engine.
 * Returns a map of playerId -> { [season]: SeasonPoints }.
 */
async function calculateSeasonPoints(
  seasons: number[],
): Promise<Map<string, Map<number, SeasonPoints>>> {
  const eligibleTeamIds = Array.from(ELIGIBLE_TEAM_IDS);
  const leagueTypes = Array.from(LEAGUE_COMPETITION_TYPES);

  const [battingPerfs, bowlingPerfs, fieldingPerfs, matchResults] = await Promise.all([
    client
      .selectFrom("match_performance_batting")
      .where("season", "in", seasons)
      .where("team_id", "in", eligibleTeamIds)
      .where("competition_type", "in", leagueTypes)
      .select(["player_id", "match_id", "season", "team_id", "runs", "balls", "fours", "sixes", "not_out"])
      .execute(),
    client
      .selectFrom("match_performance_bowling")
      .where("season", "in", seasons)
      .where("team_id", "in", eligibleTeamIds)
      .where("competition_type", "in", leagueTypes)
      .select(["player_id", "match_id", "season", "team_id", "overs", "maidens", "runs", "wickets"])
      .execute(),
    client
      .selectFrom("match_performance_fielding")
      .where("season", "in", seasons)
      .where("team_id", "in", eligibleTeamIds)
      .where("competition_type", "in", leagueTypes)
      .select(["player_id", "match_id", "season", "team_id", "catches", "run_outs", "stumpings", "is_wicketkeeper"])
      .execute(),
    client
      .selectFrom("match_result")
      .where("season", "in", seasons)
      .where("competition_type", "in", leagueTypes)
      .select(["match_id", "result_applied_to"])
      .execute(),
  ]);

  const winnerByMatch = new Map<string, string>();
  for (const r of matchResults) {
    if (r.result_applied_to) winnerByMatch.set(r.match_id, r.result_applied_to);
  }

  const mkKey = (playerId: string, matchId: string) => `${playerId}:${matchId}`;

  const battingByMatch = new Map<string, (typeof battingPerfs)[0]>();
  for (const b of battingPerfs) battingByMatch.set(mkKey(b.player_id, b.match_id), b);

  const bowlingByMatch = new Map<string, (typeof bowlingPerfs)[0]>();
  for (const b of bowlingPerfs) bowlingByMatch.set(mkKey(b.player_id, b.match_id), b);

  const fieldingByMatch = new Map<string, (typeof fieldingPerfs)[0]>();
  for (const f of fieldingPerfs) fieldingByMatch.set(mkKey(f.player_id, f.match_id), f);

  type Appearance = { playerId: string; matchId: string; season: number; teamId: string };
  const appearances = new Map<string, Appearance>();
  for (const b of battingPerfs) {
    const k = mkKey(b.player_id, b.match_id);
    if (!appearances.has(k)) appearances.set(k, { playerId: b.player_id, matchId: b.match_id, season: b.season, teamId: b.team_id });
  }
  for (const b of bowlingPerfs) {
    const k = mkKey(b.player_id, b.match_id);
    if (!appearances.has(k)) appearances.set(k, { playerId: b.player_id, matchId: b.match_id, season: b.season, teamId: b.team_id });
  }
  for (const f of fieldingPerfs) {
    const k = mkKey(f.player_id, f.match_id);
    if (!appearances.has(k)) appearances.set(k, { playerId: f.player_id, matchId: f.match_id, season: f.season, teamId: f.team_id });
  }

  const result = new Map<string, Map<number, SeasonPoints>>();

  for (const [mk, app] of appearances) {
    const bat = battingByMatch.get(mk);
    const bowl = bowlingByMatch.get(mk);
    const field = fieldingByMatch.get(mk);

    let matchPoints = 0;

    if (bat) {
      matchPoints += calculateBattingPoints({
        runs: bat.runs,
        balls: bat.balls,
        fours: bat.fours,
        sixes: bat.sixes,
        notOut: bat.not_out === 1,
      }).total;
    }

    if (bowl) {
      matchPoints += calculateBowlingPoints({
        overs: bowl.overs,
        maidens: bowl.maidens,
        runs: bowl.runs,
        wickets: bowl.wickets,
      }).total;
    }

    if (field) {
      matchPoints += calculateFieldingPoints({
        catches: field.catches,
        runOuts: field.run_outs,
        stumpings: field.stumpings,
        isWicketkeeper: field.is_wicketkeeper === 1,
      }).total;
    }

    const winner = winnerByMatch.get(app.matchId);
    if (winner === app.teamId) {
      matchPoints += SCORING.team.winBonus;
    }

    let playerMap = result.get(app.playerId);
    if (!playerMap) {
      playerMap = new Map();
      result.set(app.playerId, playerMap);
    }

    const existing = playerMap.get(app.season) ?? { totalPoints: 0, matchesPlayed: 0 };
    existing.totalPoints += matchPoints;
    existing.matchesPlayed += 1;
    playerMap.set(app.season, existing);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

const listPlayers = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    search: z.string().optional(),
  }),
  handler: async ({ search }) => {
    const cutoffSeason = new Date().getFullYear() - 3;

    let query = client
      .selectFrom("fantasy_player")
      .selectAll()
      .where(
        "play_cricket_id",
        "in",
        sql<string>`(
          SELECT DISTINCT player_id FROM match_performance_batting WHERE season >= ${cutoffSeason}
          UNION
          SELECT DISTINCT player_id FROM match_performance_bowling WHERE season >= ${cutoffSeason}
          UNION
          SELECT DISTINCT player_id FROM match_performance_fielding WHERE season >= ${cutoffSeason}
        )`,
      )
      .orderBy("player_name", "asc");

    if (search) {
      query = query.where("player_name", "like", `%${search}%`);
    }

    const players = await query.execute();
    return { players };
  },
});

const toggleEligibility = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    playCricketId: z.string(),
    eligible: z.boolean(),
  }),
  handler: async ({ playCricketId, eligible }) => {
    await client
      .updateTable("fantasy_player")
      .set({ eligible: eligible ? 1 : 0 })
      .where("play_cricket_id", "=", playCricketId)
      .execute();

    return { success: true };
  },
});

const populatePlayers = defineAuthAction({
  roles: ["admin"],
  handler: async () => {
    // Use bulk INSERT OR IGNORE + UPDATE to upsert all players in two queries,
    // avoiding the serverless function timeout that occurs with one-by-one inserts.
    // (SQLite/libsql doesn't support INSERT...SELECT...ON CONFLICT together.)
    const allPlayers = sql`(
      SELECT player_id, player_name, MAX(rowid) as latest
      FROM (
        SELECT player_id, player_name, rowid FROM match_performance_batting
        UNION ALL
        SELECT player_id, player_name, rowid FROM match_performance_bowling
        UNION ALL
        SELECT player_id, player_name, rowid FROM match_performance_fielding
      )
      GROUP BY player_id
    )`;

    // Insert any new players
    await sql`
      INSERT OR IGNORE INTO fantasy_player (play_cricket_id, player_name)
      SELECT player_id, player_name FROM ${allPlayers}
    `.execute(client);

    // Update names for existing players (in case they changed on Play Cricket)
    await sql`
      UPDATE fantasy_player
      SET player_name = (
        SELECT player_name FROM ${allPlayers} p
        WHERE p.player_id = fantasy_player.play_cricket_id
      )
      WHERE play_cricket_id IN (SELECT player_id FROM ${allPlayers})
    `.execute(client);

    const countResult = await sql`
      SELECT count(*) as total FROM fantasy_player
    `.execute(client);
    const total = (countResult.rows[0] as { total: number }).total;

    return { total, inserted: total };
  },
});

const calculateSandwichCosts = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const previousSeason = (Number(season ?? getCurrentSeason()) - 1).toString();
    const seasonNum = Number(previousSeason);

    const eligibleTeamIds = Array.from(ELIGIBLE_TEAM_IDS);
    const leagueTypes = Array.from(LEAGUE_COMPETITION_TYPES);

    // Get all eligible players
    const allEligible = await client
      .selectFrom("fantasy_player")
      .where("eligible", "=", 1)
      .select(["play_cricket_id", "player_name"])
      .execute();

    // Fetch raw match performance data from previous season
    const [battingPerfs, bowlingPerfs, fieldingPerfs, matchResults] = await Promise.all([
      client
        .selectFrom("match_performance_batting")
        .where("season", "=", seasonNum)
        .where("team_id", "in", eligibleTeamIds)
        .where("competition_type", "in", leagueTypes)
        .select(["player_id", "match_id", "team_id", "runs", "balls", "fours", "sixes", "not_out"])
        .execute(),
      client
        .selectFrom("match_performance_bowling")
        .where("season", "=", seasonNum)
        .where("team_id", "in", eligibleTeamIds)
        .where("competition_type", "in", leagueTypes)
        .select(["player_id", "match_id", "team_id", "overs", "maidens", "runs", "wickets"])
        .execute(),
      client
        .selectFrom("match_performance_fielding")
        .where("season", "=", seasonNum)
        .where("team_id", "in", eligibleTeamIds)
        .where("competition_type", "in", leagueTypes)
        .select(["player_id", "match_id", "team_id", "catches", "run_outs", "stumpings", "is_wicketkeeper"])
        .execute(),
      client
        .selectFrom("match_result")
        .where("season", "=", seasonNum)
        .where("competition_type", "in", leagueTypes)
        .select(["match_id", "result_applied_to"])
        .execute(),
    ]);

    // Build match result lookup
    const winnerByMatch = new Map<string, string>();
    for (const r of matchResults) {
      if (r.result_applied_to) winnerByMatch.set(r.match_id, r.result_applied_to);
    }

    // Index performances by "playerId:matchId"
    const mkKey = (playerId: string, matchId: string) => `${playerId}:${matchId}`;
    const battingByMatch = new Map<string, (typeof battingPerfs)[0]>();
    for (const b of battingPerfs) battingByMatch.set(mkKey(b.player_id, b.match_id), b);
    const bowlingByMatch = new Map<string, (typeof bowlingPerfs)[0]>();
    for (const b of bowlingPerfs) bowlingByMatch.set(mkKey(b.player_id, b.match_id), b);
    const fieldingByMatch = new Map<string, (typeof fieldingPerfs)[0]>();
    for (const f of fieldingPerfs) fieldingByMatch.set(mkKey(f.player_id, f.match_id), f);

    // Collect all unique match appearances per player
    type Appearance = { playerId: string; matchId: string; teamId: string };
    const appearances = new Map<string, Appearance>();
    for (const b of battingPerfs) {
      const k = mkKey(b.player_id, b.match_id);
      if (!appearances.has(k)) appearances.set(k, { playerId: b.player_id, matchId: b.match_id, teamId: b.team_id });
    }
    for (const b of bowlingPerfs) {
      const k = mkKey(b.player_id, b.match_id);
      if (!appearances.has(k)) appearances.set(k, { playerId: b.player_id, matchId: b.match_id, teamId: b.team_id });
    }
    for (const f of fieldingPerfs) {
      const k = mkKey(f.player_id, f.match_id);
      if (!appearances.has(k)) appearances.set(k, { playerId: f.player_id, matchId: f.match_id, teamId: f.team_id });
    }

    // Calculate fantasy points per player from raw match data
    const playerTotals = new Map<string, number>();
    for (const [mk, app] of appearances) {
      const bat = battingByMatch.get(mk);
      const bowl = bowlingByMatch.get(mk);
      const field = fieldingByMatch.get(mk);

      let matchPoints = 0;
      if (bat) {
        matchPoints += calculateBattingPoints({
          runs: bat.runs, balls: bat.balls, fours: bat.fours, sixes: bat.sixes, notOut: bat.not_out === 1,
        }).total;
      }
      if (bowl) {
        matchPoints += calculateBowlingPoints({
          overs: bowl.overs, maidens: bowl.maidens, runs: bowl.runs, wickets: bowl.wickets,
        }).total;
      }
      if (field) {
        matchPoints += calculateFieldingPoints({
          catches: field.catches, runOuts: field.run_outs, stumpings: field.stumpings,
          isWicketkeeper: field.is_wicketkeeper === 1,
        }).total;
      }
      const winner = winnerByMatch.get(app.matchId);
      if (winner === app.teamId) matchPoints += SCORING.team.winBonus;

      playerTotals.set(app.playerId, (playerTotals.get(app.playerId) ?? 0) + matchPoints);
    }

    // Sort eligible players by total points descending
    const eligibleIds = new Set(
      allEligible.filter((p) => p.play_cricket_id).map((p) => p.play_cricket_id),
    );
    const playerNameMap = new Map(
      allEligible.filter((p) => p.play_cricket_id).map((p) => [p.play_cricket_id, p.player_name]),
    );

    const scoredPlayers = [...playerTotals.entries()]
      .filter(([id]) => eligibleIds.has(id))
      .sort((a, b) => b[1] - a[1]);

    const scoredPlayerIds = new Set(scoredPlayers.map(([id]) => id));
    const unscoredPlayers = allEligible.filter(
      (p) => p.play_cricket_id && !scoredPlayerIds.has(p.play_cricket_id),
    );

    // Assign costs using weighted percentile buckets
    const total = scoredPlayers.length;
    const costAssignments: Array<{
      playCricketId: string;
      playerName: string;
      totalPoints: number;
      cost: number;
    }> = [];

    for (let i = 0; i < scoredPlayers.length; i++) {
      const entry = scoredPlayers[i];
      if (!entry) continue;
      const [playerId, totalPoints] = entry;
      const percentileFromTop = (i / total) * 100;
      let cost: number;
      if (percentileFromTop < 10) cost = 5;
      else if (percentileFromTop < 30) cost = 4;
      else if (percentileFromTop < 50) cost = 3;
      else if (percentileFromTop < 70) cost = 2;
      else cost = 1;

      costAssignments.push({
        playCricketId: playerId,
        playerName: playerNameMap.get(playerId) ?? playerId,
        totalPoints,
        cost,
      });
    }

    // Update sandwich_cost in DB
    for (const assignment of costAssignments) {
      await client
        .updateTable("fantasy_player")
        .set({ sandwich_cost: assignment.cost })
        .where("play_cricket_id", "=", assignment.playCricketId)
        .execute();
    }

    // Unscored players get cost 1
    for (const p of unscoredPlayers) {
      if (p.play_cricket_id) {
        await client
          .updateTable("fantasy_player")
          .set({ sandwich_cost: 1 })
          .where("play_cricket_id", "=", p.play_cricket_id)
          .execute();
      }
    }

    // Build distribution summary
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const a of costAssignments) {
      distribution[a.cost as keyof typeof distribution]++;
    }
    distribution[1] += unscoredPlayers.length;

    return {
      totalPlayers: costAssignments.length + unscoredPlayers.length,
      scoredPlayers: costAssignments.length,
      unscoredPlayers: unscoredPlayers.length,
      distribution,
      budget: SANDWICH_BUDGET,
      season: previousSeason,
      topPlayers: costAssignments.slice(0, 10).map((a) => ({
        name: a.playerName,
        points: a.totalPoints,
        cost: a.cost,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Member actions
// ---------------------------------------------------------------------------

const getEligiblePlayers = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();
    const previousSeason = (Number(currentSeason) - 1).toString();
    const seasons = [Number(currentSeason), Number(previousSeason)];

    const players = await client
      .selectFrom("fantasy_player")
      .where("eligible", "=", 1)
      .selectAll()
      .orderBy("player_name", "asc")
      .execute();

    const allSeasonPoints = await calculateSeasonPoints(seasons);

    const emptySeasonPoints: SeasonPoints = { totalPoints: 0, matchesPlayed: 0 };

    // Fetch ownership stats for current gameweek (works in pre-season too, gameweek=0)
    const currentGameweek = getCurrentGameweek(currentSeason);
    const { ownershipMap } = await getOwnershipData(currentSeason, currentGameweek);

    return {
      players: players
        .filter((p): p is typeof p & { play_cricket_id: string } => p.play_cricket_id !== null)
        .map((p) => {
          const playerSeasons = allSeasonPoints.get(p.play_cricket_id);
          const pts = {
            current: playerSeasons?.get(Number(currentSeason)) ?? { ...emptySeasonPoints },
            previous: playerSeasons?.get(Number(previousSeason)) ?? { ...emptySeasonPoints },
          };
          const ownership = ownershipMap.get(p.play_cricket_id);
          return {
            playCricketId: p.play_cricket_id,
            playerName: p.player_name,
            sandwichCost: p.sandwich_cost,
            ownershipPct: ownership?.ownershipPct ?? 0,
            stats: {
              current: {
                totalPoints: pts.current.totalPoints,
                matchesPlayed: pts.current.matchesPlayed,
                avgPoints: pts.current.matchesPlayed > 0
                  ? Math.round((pts.current.totalPoints / pts.current.matchesPlayed) * 10) / 10
                  : null,
              },
              previous: {
                totalPoints: pts.previous.totalPoints,
                matchesPlayed: pts.previous.matchesPlayed,
                avgPoints: pts.previous.matchesPlayed > 0
                  ? Math.round((pts.previous.totalPoints / pts.previous.matchesPlayed) * 10) / 10
                  : null,
              },
            },
          };
        }),
      season: currentSeason,
      previousSeason,
      budget: SANDWICH_BUDGET,
    };
  },
});

const getMyTeam = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }, session) => {
    const currentSeason = season ?? getCurrentSeason();
    const gameweek = getCurrentGameweek(currentSeason);

    const team = await client
      .selectFrom("fantasy_team")
      .where("user_id", "=", session.user.id)
      .where("season", "=", currentSeason)
      .selectAll()
      .executeTakeFirst();

    const chaosWeek = await getActiveChaosWeek(currentSeason, gameweek);

    if (!team) {
      return {
        team: null,
        players: [],
        transferWindowInfo: getTransferWindowInfo(currentSeason),
        gameweek,
        transfersUsed: 0,
        maxTransfers: null, // No team yet = unlimited initial selection
        chaosWeek,
      };
    }

    // Get active players (gameweek_added <= current AND (gameweek_removed IS NULL OR gameweek_removed > current))
    const players = await client
      .selectFrom("fantasy_team_player as ftp")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "ftp.play_cricket_id",
      )
      .where("ftp.fantasy_team_id", "=", requireId(team.id))
      .where("ftp.gameweek_added", "<=", gameweek)
      .where((eb) =>
        eb.or([
          eb("ftp.gameweek_removed", "is", null),
          eb("ftp.gameweek_removed", ">", gameweek),
        ]),
      )
      .select([
        "ftp.id",
        "ftp.play_cricket_id",
        "fp.player_name",
        "fp.sandwich_cost",
        "ftp.is_captain",
        "ftp.gameweek_added",
        "ftp.slot_type",
        "ftp.is_wicketkeeper",
      ])
      .execute();

    // Count transfers made this gameweek (only still-active ones, not reverted)
    const transfersThisWeek = await client
      .selectFrom("fantasy_team_player")
      .where("fantasy_team_id", "=", requireId(team.id))
      .where("gameweek_added", "=", gameweek)
      .where((eb) =>
        eb.or([
          eb("gameweek_removed", "is", null),
          eb("gameweek_removed", ">", gameweek),
        ]),
      )
      .select(sql<number>`COUNT(*)`.as("count"))
      .executeTakeFirst();

    // Subtract initial squad size for gameweek 1 (not transfers)
    // For subsequent gameweeks, only count players added THIS gameweek as transfers
    const initialPlayers = await client
      .selectFrom("fantasy_team_player")
      .where("fantasy_team_id", "=", requireId(team.id))
      .where("gameweek_added", "<", gameweek)
      .where((eb) =>
        eb.or([
          eb("gameweek_removed", "is", null),
          eb("gameweek_removed", ">", gameweek - 1),
        ]),
      )
      .select(sql<number>`COUNT(*)`.as("count"))
      .executeTakeFirst();

    const isInitialSquad = (initialPlayers?.count ?? 0) === 0;
    const transfersUsed = isInitialSquad ? 0 : (transfersThisWeek?.count ?? 0);

    // Transfers are unlimited in pre-season or if this is the user's first squad
    const unlimitedTransfers = isPreSeason(currentSeason) || isInitialSquad;

    return {
      team: { id: team.id, season: team.season, createdAt: team.created_at },
      players: players.map((p) => ({
        id: p.id,
        playCricketId: p.play_cricket_id,
        playerName: p.player_name,
        sandwichCost: p.sandwich_cost,
        isCaptain: p.is_captain === 1,
        gameweekAdded: p.gameweek_added,
        slotType: p.slot_type as SlotType,
        isWicketkeeper: p.is_wicketkeeper === 1,
      })),
      transferWindowInfo: getTransferWindowInfo(currentSeason),
      gameweek,
      transfersUsed,
      maxTransfers: unlimitedTransfers ? null : MAX_TRANSFERS_PER_GAMEWEEK,
      budget: SANDWICH_BUDGET,
      chaosWeek,
    };
  },
});

const saveTeam = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
    players: z
      .array(
        z.object({
          playCricketId: z.string(),
          isCaptain: z.boolean(),
          slotType: z.enum(["batting", "bowling", "allrounder"]),
          isWicketkeeper: z.boolean(),
        }),
      )
      .length(11),
  }),
  handler: async ({ season, players }, session) => {
    const currentSeason = season ?? getCurrentSeason();

    // Enforce lock (pre-season is never locked)
    if (isGameweekLocked(currentSeason)) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message:
          "Team editing is locked during match weekends (Saturday–Sunday). Editing reopens Monday.",
      });
    }

    const gameweek = getCurrentGameweek(currentSeason);

    // Check for active chaos week restrictions
    const chaosWeek = await getActiveChaosWeek(currentSeason, gameweek);

    if (chaosWeek?.rule_type === "no_transfers") {
      // Only block transfers for users who already have a team.
      // Initial squad creation is always allowed — a new player shouldn't be
      // locked out of participating during a chaos week.
      const existingTeam = await client
        .selectFrom("fantasy_team")
        .where("user_id", "=", session.user.id)
        .where("season", "=", currentSeason)
        .select("id")
        .executeTakeFirst();

      if (existingTeam) {
        const currentPlayers = await client
          .selectFrom("fantasy_team_player")
          .where("fantasy_team_id", "=", requireId(existingTeam.id))
          .where("gameweek_added", "<=", gameweek)
          .where((eb) =>
            eb.or([
              eb("gameweek_removed", "is", null),
              eb("gameweek_removed", ">", gameweek),
            ]),
          )
          .select("play_cricket_id")
          .execute();

        const currentPlayerIds = new Set(
          currentPlayers.map((p) => p.play_cricket_id),
        );
        const newPlayerIds = new Set(players.map((p) => p.playCricketId));

        const hasTransfer =
          players.some((p) => !currentPlayerIds.has(p.playCricketId)) ||
          currentPlayers.some((p) => !newPlayerIds.has(p.play_cricket_id));

        if (hasTransfer) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: `Chaos week: "${chaosWeek.name}" — no transfers allowed this gameweek! You can still change captain, slots, and wicketkeeper.`,
          });
        }
      }
    }

    if (chaosWeek?.rule_type === "no_captain_change") {
      // Check if user already has a team with a captain — if so, captain must stay the same
      const existingTeam = await client
        .selectFrom("fantasy_team")
        .where("user_id", "=", session.user.id)
        .where("season", "=", currentSeason)
        .select("id")
        .executeTakeFirst();

      if (existingTeam) {
        const currentCaptain = await client
          .selectFrom("fantasy_team_player")
          .where("fantasy_team_id", "=", requireId(existingTeam.id))
          .where("is_captain", "=", 1)
          .where("gameweek_added", "<=", gameweek)
          .where((eb) =>
            eb.or([
              eb("gameweek_removed", "is", null),
              eb("gameweek_removed", ">", gameweek),
            ]),
          )
          .select("play_cricket_id")
          .executeTakeFirst();

        const newCaptain = players.find((p) => p.isCaptain);

        if (
          currentCaptain &&
          newCaptain &&
          currentCaptain.play_cricket_id !== newCaptain.playCricketId
        ) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: `Chaos week: "${chaosWeek.name}" — captain cannot be changed this gameweek!`,
          });
        }
      }
    }

    // Validate exactly one captain
    const captains = players.filter((p) => p.isCaptain);
    if (captains.length !== 1) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Exactly one player must be designated as captain.",
      });
    }

    // Validate no duplicate players
    const playerIds = new Set(players.map((p) => p.playCricketId));
    if (playerIds.size !== 11) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "All 11 players must be different.",
      });
    }

    // Validate slot counts
    const slotCounts = { batting: 0, bowling: 0, allrounder: 0 };
    for (const p of players) {
      slotCounts[p.slotType]++;
    }
    if (
      slotCounts.batting !== SLOT_COUNTS.batting ||
      slotCounts.bowling !== SLOT_COUNTS.bowling ||
      slotCounts.allrounder !== SLOT_COUNTS.allrounder
    ) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: `Team must have exactly ${SLOT_COUNTS.batting} batting, ${SLOT_COUNTS.bowling} bowling, and ${SLOT_COUNTS.allrounder} all-rounder slot(s).`,
      });
    }

    // Validate exactly 1 wicketkeeper
    const wkCount = players.filter((p) => p.isWicketkeeper).length;
    if (wkCount !== 1) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Exactly one player must be designated as wicketkeeper.",
      });
    }

    // Validate captain is NOT in allrounder slot
    const captain = players.find((p) => p.isCaptain);
    if (captain?.slotType === "allrounder") {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "The captain cannot be placed in the all-rounder slot.",
      });
    }

    // Validate all players are eligible and get their sandwich costs
    const eligiblePlayers = await client
      .selectFrom("fantasy_player")
      .where("play_cricket_id", "in", Array.from(playerIds))
      .where("eligible", "=", 1)
      .select(["play_cricket_id", "sandwich_cost"])
      .execute();

    if (eligiblePlayers.length !== 11) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "All selected players must be eligible for fantasy cricket.",
      });
    }

    // Validate sandwich budget
    const costMap = new Map(
      eligiblePlayers.map((p) => [p.play_cricket_id, p.sandwich_cost]),
    );
    let totalCost = 0;
    for (const p of players) {
      totalCost += costMap.get(p.playCricketId) ?? 1;
    }
    if (totalCost > SANDWICH_BUDGET) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: `Team sandwich budget exceeded. Total cost: ${totalCost}, budget: ${SANDWICH_BUDGET}.`,
      });
    }

    // Use a transaction to prevent race conditions on transfer limits
    return await client.transaction().execute(async (trx) => {
      // Get or create team
      let teamId: number;
      const existingTeam = await trx
        .selectFrom("fantasy_team")
        .where("user_id", "=", session.user.id)
        .where("season", "=", currentSeason)
        .select("id")
        .executeTakeFirst();

      if (!existingTeam) {
        // Create new team — this is the initial squad, no transfer limits
        const result = await trx
          .insertInto("fantasy_team")
          .values({
            user_id: session.user.id,
            season: currentSeason,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        teamId = requireId(result.id);

        // Insert all 11 players
        for (const player of players) {
          await trx
            .insertInto("fantasy_team_player")
            .values({
              fantasy_team_id: teamId,
              play_cricket_id: player.playCricketId,
              is_captain: player.isCaptain ? 1 : 0,
              gameweek_added: gameweek,
              slot_type: player.slotType,
              is_wicketkeeper: player.isWicketkeeper ? 1 : 0,
            })
            .execute();
        }

        return { success: true, teamId };
      }

      teamId = requireId(existingTeam.id);

      // Existing team — handle transfers
      const currentPlayers = await trx
        .selectFrom("fantasy_team_player")
        .where("fantasy_team_id", "=", teamId)
        .where("gameweek_added", "<=", gameweek)
        .where((eb) =>
          eb.or([
            eb("gameweek_removed", "is", null),
            eb("gameweek_removed", ">", gameweek),
          ]),
        )
        .selectAll()
        .execute();

      const currentPlayerIds = new Set(
        currentPlayers.map((p) => p.play_cricket_id),
      );
      const newPlayerIds = new Set(players.map((p) => p.playCricketId));

      // Find players being added and removed
      const playersToAdd = players.filter(
        (p) => !currentPlayerIds.has(p.playCricketId),
      );
      const playersToRemove = currentPlayers.filter(
        (p) => !newPlayerIds.has(p.play_cricket_id),
      );

      // Check transfer limit — only applies in-season when modifying an existing squad
      // Pre-season and initial squad selections are always unlimited
      if (currentPlayers.length > 0 && playersToAdd.length > 0 && !isPreSeason(currentSeason)) {
        const hasSquadFromBefore = currentPlayers.some(
          (p) => p.gameweek_added < gameweek,
        );

        if (hasSquadFromBefore) {
          // Count transfers already committed this gameweek (excluding the
          // initial squad which was all added in an earlier gameweek).
          // Players that were added this gameweek and are now being un-done
          // (removed in this same request) effectively free up a transfer slot.
          const addedThisWeekBeingRemoved = playersToRemove.filter(
            (p) => p.gameweek_added === gameweek,
          ).length;

          // Count transfers already persisted this gameweek that are still active
          // (exclude rows that were added and then reverted in a previous save)
          const persistedTransfers = await trx
            .selectFrom("fantasy_team_player")
            .where("fantasy_team_id", "=", teamId)
            .where("gameweek_added", "=", gameweek)
            .where((eb) =>
              eb.or([
                eb("gameweek_removed", "is", null),
                eb("gameweek_removed", ">", gameweek),
              ]),
            )
            .select(sql<number>`COUNT(*)`.as("count"))
            .executeTakeFirst();

          const previousTransfers = persistedTransfers?.count ?? 0;
          const netTransfers =
            previousTransfers + playersToAdd.length - addedThisWeekBeingRemoved;

          if (netTransfers > MAX_TRANSFERS_PER_GAMEWEEK) {
            throw new ActionError({
              code: "BAD_REQUEST",
              message: `You can only make ${MAX_TRANSFERS_PER_GAMEWEEK} transfers per gameweek. You have used ${previousTransfers} already.`,
            });
          }
        }
      }

      // Apply removals — mark gameweek_removed
      for (const player of playersToRemove) {
        await trx
          .updateTable("fantasy_team_player")
          .set({ gameweek_removed: gameweek })
          .where("id", "=", requireId(player.id))
          .execute();
      }

      // Apply additions
      for (const player of playersToAdd) {
        await trx
          .insertInto("fantasy_team_player")
          .values({
            fantasy_team_id: teamId,
            play_cricket_id: player.playCricketId,
            is_captain: player.isCaptain ? 1 : 0,
            gameweek_added: gameweek,
            slot_type: player.slotType,
            is_wicketkeeper: player.isWicketkeeper ? 1 : 0,
          })
          .execute();
      }

      // Update captain, slot_type, and is_wicketkeeper for existing players
      for (const player of players) {
        if (currentPlayerIds.has(player.playCricketId)) {
          const existing = currentPlayers.find(
            (p) => p.play_cricket_id === player.playCricketId,
          );
          if (existing) {
            const captainChanged = (existing.is_captain === 1) !== player.isCaptain;
            const slotChanged = existing.slot_type !== player.slotType;
            const wkChanged = (existing.is_wicketkeeper === 1) !== player.isWicketkeeper;
            if (captainChanged || slotChanged || wkChanged) {
              await trx
                .updateTable("fantasy_team_player")
                .set({
                  is_captain: player.isCaptain ? 1 : 0,
                  slot_type: player.slotType,
                  is_wicketkeeper: player.isWicketkeeper ? 1 : 0,
                })
                .where("id", "=", requireId(existing.id))
                .execute();
            }
          }
        }
      }

      return { success: true, teamId };
    });
  },
});

const getTeam = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    teamId: z.number(),
  }),
  handler: async ({ teamId }) => {
    const team = await client
      .selectFrom("fantasy_team as ft")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("ft.id", "=", teamId)
      .select([
        "ft.id",
        "ft.season",
        "ft.created_at",
        "u.name as ownerName",
        "u.id as ownerId",
      ])
      .executeTakeFirst();

    if (!team) {
      throw new ActionError({ code: "NOT_FOUND", message: "Team not found." });
    }

    const gameweek = getCurrentGameweek(team.season);

    const players = await client
      .selectFrom("fantasy_team_player as ftp")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "ftp.play_cricket_id",
      )
      .where("ftp.fantasy_team_id", "=", requireId(team.id))
      .where("ftp.gameweek_added", "<=", gameweek)
      .where((eb) =>
        eb.or([
          eb("ftp.gameweek_removed", "is", null),
          eb("ftp.gameweek_removed", ">", gameweek),
        ]),
      )
      .select([
        "ftp.play_cricket_id",
        "fp.player_name",
        "fp.sandwich_cost",
        "ftp.is_captain",
        "ftp.slot_type",
        "ftp.is_wicketkeeper",
      ])
      .execute();

    const { ownershipMap } = await getOwnershipData(team.season, gameweek);

    return {
      team: {
        id: team.id,
        season: team.season,
        ownerName: team.ownerName,
        ownerId: team.ownerId,
      },
      players: players.map((p) => {
        const ownership = ownershipMap.get(p.play_cricket_id);
        return {
          playCricketId: p.play_cricket_id,
          playerName: p.player_name,
          sandwichCost: p.sandwich_cost,
          isCaptain: p.is_captain === 1,
          slotType: p.slot_type as SlotType,
          isWicketkeeper: p.is_wicketkeeper === 1,
          ownershipPct: ownership?.ownershipPct ?? 0,
        };
      }),
    };
  },
});

const getTeamShareData = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async (_input, session) => {
    const season = _input.season ?? getCurrentSeason();

    const team = await client
      .selectFrom("fantasy_team as ft")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("ft.user_id", "=", session.user.id)
      .where("ft.season", "=", season)
      .select([
        "ft.id",
        "ft.season",
        "u.name as ownerName",
      ])
      .executeTakeFirst();

    if (!team) {
      throw new ActionError({ code: "NOT_FOUND", message: "Team not found." });
    }

    const gameweek = getCurrentGameweek(team.season);

    // Build a human-readable gameweek label
    const gw1 = getGW1StartDate(team.season);
    let gameweekLabel: string;
    if (gameweek === 0) {
      gameweekLabel = "Pre-Season";
    } else {
      const gwStartMs = gw1.getTime() + (gameweek - 1) * 7 * 24 * 60 * 60 * 1000;
      const gwStart = new Date(gwStartMs);
      const dateStr = gwStart.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      gameweekLabel = `Gameweek ${gameweek}: ${dateStr}`;
    }

    const players = await client
      .selectFrom("fantasy_team_player as ftp")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "ftp.play_cricket_id",
      )
      .leftJoin("member as m", "m.play_cricket_id", "ftp.play_cricket_id")
      .where("ftp.fantasy_team_id", "=", requireId(team.id))
      .where("ftp.gameweek_added", "<=", gameweek)
      .where((eb) =>
        eb.or([
          eb("ftp.gameweek_removed", "is", null),
          eb("ftp.gameweek_removed", ">", gameweek),
        ]),
      )
      .select([
        "ftp.play_cricket_id",
        "fp.player_name",
        "fp.sandwich_cost",
        "ftp.is_captain",
        "ftp.slot_type",
        "ftp.is_wicketkeeper",
        "m.contentful_entry_id",
      ])
      .execute();

    // Batch-fetch photo URLs from Contentful for players with linked entries
    const contentfulIds = players
      .map((p) => p.contentful_entry_id)
      .filter((id): id is string => id != null);

    const photoMap = new Map<string, string>();
    if (contentfulIds.length > 0) {
      const { contentClient } = await import("@/lib/contentful/client");
      const entries = await contentClient.getEntries({
        content_type: "trustee",
        "sys.id[in]": contentfulIds,
        limit: contentfulIds.length,
      });
      const photoFieldSchema = z
        .object({
          fields: z
            .object({
              file: z.object({ url: z.string() }).optional(),
            })
            .optional(),
        })
        .optional();

      for (const entry of entries.items) {
        const parsed = photoFieldSchema.safeParse(entry.fields.photo);
        const url = parsed.success ? parsed.data?.fields?.file?.url : undefined;
        if (url) {
          photoMap.set(entry.sys.id, url.startsWith("//") ? `https:${url}` : url);
        }
      }
    }

    const totalSandwichCost = players.reduce(
      (sum, p) => sum + p.sandwich_cost,
      0,
    );

    return {
      ownerName: team.ownerName,
      season: team.season,
      totalSandwichCost,
      gameweekLabel,
      players: players.map((p) => ({
        playerName: p.player_name,
        sandwichCost: p.sandwich_cost,
        isCaptain: p.is_captain === 1,
        slotType: p.slot_type as SlotType,
        isWicketkeeper: p.is_wicketkeeper === 1,
        photoUrl: p.contentful_entry_id
          ? photoMap.get(p.contentful_entry_id) ?? null
          : null,
      })),
    };
  },
});

const listTeams = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();

    const teams = await client
      .selectFrom("fantasy_team as ft")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("ft.season", "=", currentSeason)
      .select([
        "ft.id",
        "ft.season",
        "ft.created_at",
        "u.name as ownerName",
        "u.id as ownerId",
      ])
      .orderBy("ft.created_at", "asc")
      .execute();

    return {
      teams: teams.map((t) => ({
        id: t.id,
        season: t.season,
        ownerName: t.ownerName,
        ownerId: t.ownerId,
        createdAt: t.created_at,
      })),
      season: currentSeason,
    };
  },
});

const getTransferWindow = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();
    return getTransferWindowInfo(currentSeason);
  },
});

// ---------------------------------------------------------------------------
// Admin: recalculate scores
// ---------------------------------------------------------------------------

const calculateScores = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const s = season ?? getCurrentSeason();
    const result = await calculateFantasyScores(client, s);
    return result;
  },
});

// ---------------------------------------------------------------------------
// Public leaderboard actions
// ---------------------------------------------------------------------------

const getWeeklyLeaderboard = defineAction({
  input: z.object({
    season: z.string().optional(),
    gameweek: z.number().optional(),
  }),
  handler: async ({ season, gameweek }) => {
    const currentSeason = season ?? getCurrentSeason();

    // Default to the most recent completed gameweek (current - 1).
    // This avoids showing a partially-played current gameweek.
    // If no scores exist for that gameweek, fall back to the latest
    // gameweek that has any scores.
    let targetGameweek = gameweek;
    if (targetGameweek === undefined) {
      const currentGw = getCurrentGameweek(currentSeason);
      const completedGw = Math.max(0, currentGw - 1);

      // Check if the completed gameweek has scores; if not, use the
      // latest gameweek that does (handles early season with no data)
      if (completedGw > 0) {
        const hasScores = await client
          .selectFrom("fantasy_team_score")
          .where("season", "=", currentSeason)
          .where("gameweek_id", "=", completedGw)
          .select("gameweek_id")
          .limit(1)
          .executeTakeFirst();

        if (hasScores) {
          targetGameweek = completedGw;
        }
      }

      if (targetGameweek === undefined) {
        const latestGw = await client
          .selectFrom("fantasy_team_score")
          .where("season", "=", currentSeason)
          .select(sql<number>`MAX(gameweek_id)`.as("max_gw"))
          .executeTakeFirst();
        targetGameweek = latestGw?.max_gw ?? 0;
      }
    }

    if (targetGameweek === 0) {
      return { entries: [], gameweek: 0, season: currentSeason, availableGameweeks: [] };
    }

    // Get available gameweeks for the selector
    const gws = await client
      .selectFrom("fantasy_team_score")
      .where("season", "=", currentSeason)
      .select("gameweek_id")
      .distinct()
      .orderBy("gameweek_id", "desc")
      .execute();

    const availableGameweeks = gws.map((r) => r.gameweek_id);

    // Get leaderboard for the target gameweek
    const entries = await client
      .selectFrom("fantasy_team_score as fts")
      .innerJoin("fantasy_team as ft", "ft.id", "fts.fantasy_team_id")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("fts.gameweek_id", "=", targetGameweek)
      .where("fts.season", "=", currentSeason)
      .select([
        "fts.fantasy_team_id",
        "fts.total_points",
        "u.name as ownerName",
      ])
      .orderBy("fts.total_points", "desc")
      .execute();

    const ranked = assignRanks(
      entries.map((e) => ({
        teamId: e.fantasy_team_id,
        ownerName: e.ownerName,
        weeklyPoints: e.total_points,
      })),
      (e) => e.weeklyPoints,
    );

    return {
      entries: ranked,
      gameweek: targetGameweek,
      season: currentSeason,
      availableGameweeks,
    };
  },
});

const getSeasonLeaderboard = defineAction({
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();

    const entries = await client
      .selectFrom("fantasy_team_score as fts")
      .innerJoin("fantasy_team as ft", "ft.id", "fts.fantasy_team_id")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("fts.season", "=", currentSeason)
      .select([
        "fts.fantasy_team_id",
        sql<number>`SUM(fts.total_points)`.as("total_points"),
        sql<number>`COUNT(DISTINCT fts.gameweek_id)`.as("gameweeks_played"),
        "u.name as ownerName",
      ])
      .groupBy("fts.fantasy_team_id")
      .orderBy(sql`SUM(fts.total_points)`, "desc")
      .execute();

    const ranked = assignRanks(
      entries.map((e) => ({
        teamId: e.fantasy_team_id,
        ownerName: e.ownerName,
        totalPoints: e.total_points,
        gameweeksPlayed: e.gameweeks_played,
      })),
      (e) => e.totalPoints,
    );

    return {
      entries: ranked,
      season: currentSeason,
    };
  },
});

const getPlayerLeaderboard = defineAction({
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();

    const entries = await client
      .selectFrom("fantasy_player_score as fps")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "fps.play_cricket_id",
      )
      .where("fps.season", "=", currentSeason)
      .where("fp.eligible", "=", 1)
      .select([
        "fps.play_cricket_id",
        "fp.player_name",
        sql<number>`SUM(fps.batting_points)`.as("batting_points"),
        sql<number>`SUM(fps.bowling_points)`.as("bowling_points"),
        sql<number>`SUM(fps.fielding_points)`.as("fielding_points"),
        sql<number>`SUM(fps.team_points)`.as("team_points"),
        sql<number>`SUM(fps.total_points)`.as("total_points"),
        sql<number>`COUNT(DISTINCT fps.match_id)`.as("matches_played"),
      ])
      .groupBy("fps.play_cricket_id")
      .orderBy(sql`SUM(fps.total_points)`, "desc")
      .execute();

    const ranked = assignRanks(
      entries.map((e) => ({
        playCricketId: e.play_cricket_id,
        playerName: e.player_name,
        battingPoints: e.batting_points,
        bowlingPoints: e.bowling_points,
        fieldingPoints: e.fielding_points,
        teamPoints: e.team_points,
        totalPoints: e.total_points,
        matchesPlayed: e.matches_played,
      })),
      (e) => e.totalPoints,
    );

    return {
      entries: ranked,
      season: currentSeason,
    };
  },
});

// ---------------------------------------------------------------------------
// Historical view actions
// ---------------------------------------------------------------------------

/**
 * Get detailed gameweek results for a specific team.
 * Shows team snapshot (who was on the team) and per-player points breakdown.
 */
const getGameweekDetail = defineAction({
  input: z.object({
    season: z.string().optional(),
    gameweek: z.number(),
    teamId: z.number(),
  }),
  handler: async ({ season, gameweek, teamId }) => {
    const currentSeason = season ?? getCurrentSeason();

    // Get team info
    const team = await client
      .selectFrom("fantasy_team as ft")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("ft.id", "=", teamId)
      .select(["ft.id", "ft.season", "u.name as ownerName"])
      .executeTakeFirst();

    if (!team) {
      throw new ActionError({ code: "NOT_FOUND", message: "Team not found." });
    }

    // Get team score for this gameweek
    const teamScore = await client
      .selectFrom("fantasy_team_score")
      .where("fantasy_team_id", "=", teamId)
      .where("gameweek_id", "=", gameweek)
      .where("season", "=", currentSeason)
      .select("total_points")
      .executeTakeFirst();

    // Get players who were on the team during this gameweek
    const players = await client
      .selectFrom("fantasy_team_player as ftp")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "ftp.play_cricket_id",
      )
      .where("ftp.fantasy_team_id", "=", teamId)
      .where("ftp.gameweek_added", "<=", gameweek)
      .where((eb) =>
        eb.or([
          eb("ftp.gameweek_removed", "is", null),
          eb("ftp.gameweek_removed", ">", gameweek),
        ]),
      )
      .select([
        "ftp.play_cricket_id",
        "fp.player_name",
        "ftp.is_captain",
        "ftp.slot_type",
        "ftp.is_wicketkeeper",
      ])
      .execute();

    // Get per-player scores for this gameweek
    const playerScores = await client
      .selectFrom("fantasy_player_score")
      .where("season", "=", currentSeason)
      .where("gameweek_id", "=", gameweek)
      .where(
        "play_cricket_id",
        "in",
        players.map((p) => p.play_cricket_id),
      )
      .select([
        "play_cricket_id",
        "batting_points",
        "bowling_points",
        "fielding_points",
        "team_points",
        "total_points",
        "match_id",
        "catches",
        "stumpings",
        "is_actual_keeper",
      ])
      .execute();

    // Group scores by player (a player might have multiple matches in a gameweek)
    const scoresByPlayer = new Map<
      string,
      {
        battingPoints: number;
        bowlingPoints: number;
        fieldingPoints: number;
        teamPoints: number;
        totalPoints: number;
        matchCount: number;
        catches: number;
        stumpings: number;
        isActualKeeper: boolean;
      }
    >();

    for (const score of playerScores) {
      const existing = scoresByPlayer.get(score.play_cricket_id) ?? {
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        teamPoints: 0,
        totalPoints: 0,
        matchCount: 0,
        catches: 0,
        stumpings: 0,
        isActualKeeper: false,
      };
      existing.battingPoints += score.batting_points;
      existing.bowlingPoints += score.bowling_points;
      existing.fieldingPoints += score.fielding_points;
      existing.teamPoints += score.team_points;
      existing.totalPoints += score.total_points;
      existing.matchCount += 1;
      existing.catches += score.catches;
      existing.stumpings += score.stumpings;
      if (score.is_actual_keeper === 1) existing.isActualKeeper = true;
      scoresByPlayer.set(score.play_cricket_id, existing);
    }

    // Check for active chips this gameweek
    const activeChips = await client
      .selectFrom("fantasy_chip_usage")
      .where("fantasy_team_id", "=", teamId)
      .where("gameweek_id", "=", gameweek)
      .where("season", "=", currentSeason)
      .select("chip_type")
      .execute();

    const activeChipTypes = activeChips.map((c) => c.chip_type);
    const hasTripleCaptain = activeChipTypes.includes("triple_captain");
    const captainMultiplier = hasTripleCaptain
      ? CHIPS.triple_captain.captainMultiplier
      : 2;

    return {
      team: {
        id: team.id,
        ownerName: team.ownerName,
        totalPoints: teamScore?.total_points ?? 0,
      },
      gameweek,
      season: currentSeason,
      activeChips: activeChipTypes,
      players: players.map((p) => {
        const scores = scoresByPlayer.get(p.play_cricket_id);
        const isCaptain = p.is_captain === 1;
        const slotType = (p.slot_type ?? "batting") as SlotType;
        const isWicketkeeper = p.is_wicketkeeper === 1;

        const effectivePoints = scores
          ? calculateSlotEffectivePoints({
              slotType,
              isFantasyWk: isWicketkeeper,
              battingPts: scores.battingPoints,
              bowlingPts: scores.bowlingPoints,
              fieldingPts: scores.fieldingPoints,
              teamPts: scores.teamPoints,
              catches: scores.catches,
              stumpings: scores.stumpings,
              isActualKeeper: scores.isActualKeeper,
              isCaptain,
              captainMultiplier,
            })
          : 0;

        return {
          playCricketId: p.play_cricket_id,
          playerName: p.player_name,
          isCaptain,
          slotType,
          isWicketkeeper,
          battingPoints: scores?.battingPoints ?? 0,
          bowlingPoints: scores?.bowlingPoints ?? 0,
          fieldingPoints: scores?.fieldingPoints ?? 0,
          teamPoints: scores?.teamPoints ?? 0,
          basePoints: isCaptain && effectivePoints > 0
            ? Math.round(effectivePoints / captainMultiplier)
            : effectivePoints,
          effectivePoints,
          captainMultiplier: isCaptain ? captainMultiplier : 1,
          matchCount: scores?.matchCount ?? 0,
        };
      }),
    };
  },
});

/**
 * Get week-by-week season timeline for a team.
 * Returns cumulative and per-week points for charting.
 */
const getSeasonTimeline = defineAction({
  input: z.object({
    season: z.string().optional(),
    teamId: z.number(),
  }),
  handler: async ({ season, teamId }) => {
    const currentSeason = season ?? getCurrentSeason();

    const scores = await client
      .selectFrom("fantasy_team_score")
      .where("fantasy_team_id", "=", teamId)
      .where("season", "=", currentSeason)
      .select(["gameweek_id", "total_points"])
      .orderBy("gameweek_id", "asc")
      .execute();

    let cumulative = 0;
    const timeline = scores.map((s) => {
      cumulative += s.total_points;
      return {
        gameweek: s.gameweek_id,
        weeklyPoints: s.total_points,
        cumulativePoints: cumulative,
      };
    });

    return { timeline, season: currentSeason, teamId };
  },
});

/**
 * Get a player's score history across gameweeks for a season.
 */
const getPlayerHistory = defineAction({
  input: z.object({
    season: z.string().optional(),
    playCricketId: z.string(),
  }),
  handler: async ({ season, playCricketId }) => {
    const currentSeason = season ?? getCurrentSeason();

    const player = await client
      .selectFrom("fantasy_player")
      .where("play_cricket_id", "=", playCricketId)
      .select("player_name")
      .executeTakeFirst();

    if (!player) {
      throw new ActionError({ code: "NOT_FOUND", message: "Player not found." });
    }

    const scores = await client
      .selectFrom("fantasy_player_score")
      .where("play_cricket_id", "=", playCricketId)
      .where("season", "=", currentSeason)
      .select([
        "gameweek_id",
        "match_id",
        "batting_points",
        "bowling_points",
        "fielding_points",
        "team_points",
        "total_points",
      ])
      .orderBy("gameweek_id", "asc")
      .execute();

    // Group by gameweek (a player may have multiple matches per gameweek)
    const byGameweek = new Map<
      number,
      {
        battingPoints: number;
        bowlingPoints: number;
        fieldingPoints: number;
        teamPoints: number;
        totalPoints: number;
        matchCount: number;
      }
    >();

    for (const s of scores) {
      const existing = byGameweek.get(s.gameweek_id) ?? {
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        teamPoints: 0,
        totalPoints: 0,
        matchCount: 0,
      };
      existing.battingPoints += s.batting_points;
      existing.bowlingPoints += s.bowling_points;
      existing.fieldingPoints += s.fielding_points;
      existing.teamPoints += s.team_points;
      existing.totalPoints += s.total_points;
      existing.matchCount += 1;
      byGameweek.set(s.gameweek_id, existing);
    }

    const gameweeks = Array.from(byGameweek.entries())
      .sort(([a], [b]) => a - b)
      .map(([gw, data]) => ({
        gameweek: gw,
        ...data,
      }));

    return {
      playerName: player.player_name,
      playCricketId,
      season: currentSeason,
      gameweeks,
    };
  },
});

/**
 * Public gameweek highlights for the fantasy match report.
 * Returns top scorer, best spell, fantasy shock, top team, and biggest mover
 * for the most recently completed gameweek (or a specific one).
 */
const getGameweekHighlights = defineAction({
  input: z.object({
    season: z.string().optional(),
    gameweek: z.number().optional(),
  }),
  handler: async ({ season, gameweek }) => {
    const currentSeason = season ?? getCurrentSeason();

    // Determine which gameweek to show highlights for
    let targetGameweek = gameweek;
    if (targetGameweek === undefined) {
      const currentGw = getCurrentGameweek(currentSeason);
      const completedGw = Math.max(0, currentGw - 1);

      if (completedGw > 0) {
        const hasScores = await client
          .selectFrom("fantasy_team_score")
          .where("season", "=", currentSeason)
          .where("gameweek_id", "=", completedGw)
          .select("gameweek_id")
          .limit(1)
          .executeTakeFirst();

        if (hasScores) {
          targetGameweek = completedGw;
        }
      }

      if (targetGameweek === undefined) {
        const latestGw = await client
          .selectFrom("fantasy_team_score")
          .where("season", "=", currentSeason)
          .select(sql<number>`MAX(gameweek_id)`.as("max_gw"))
          .executeTakeFirst();
        targetGameweek = latestGw?.max_gw ?? 0;
      }
    }

    if (targetGameweek === 0) {
      return { highlights: null, gameweek: 0, season: currentSeason };
    }

    // --- Top scorer: highest total_points player ---
    const topScorerRows = await client
      .selectFrom("fantasy_player_score as fps")
      .innerJoin("fantasy_player as fp", "fp.play_cricket_id", "fps.play_cricket_id")
      .where("fps.season", "=", currentSeason)
      .where("fps.gameweek_id", "=", targetGameweek)
      .select([
        "fps.play_cricket_id",
        "fp.player_name",
        sql<number>`SUM(fps.total_points)`.as("total_points"),
        sql<number>`SUM(fps.batting_points)`.as("batting_points"),
        sql<number>`SUM(fps.bowling_points)`.as("bowling_points"),
      ])
      .groupBy("fps.play_cricket_id")
      .orderBy(sql`SUM(fps.total_points)`, "desc")
      .limit(1)
      .execute();

    // Fetch raw batting stats for top scorer
    let topScorerBattingRuns: number | null = null;
    if (topScorerRows[0]) {
      const batStats = await client
        .selectFrom("match_performance_batting as mpb")
        .innerJoin("fantasy_player_score as fps", (join) =>
          join
            .onRef("fps.play_cricket_id", "=", "mpb.player_id")
            .onRef("fps.match_id", "=", "mpb.match_id"),
        )
        .where("fps.season", "=", currentSeason)
        .where("fps.gameweek_id", "=", targetGameweek)
        .where("fps.play_cricket_id", "=", topScorerRows[0].play_cricket_id)
        .select(sql<number>`SUM(mpb.runs)`.as("runs"))
        .executeTakeFirst();
      topScorerBattingRuns = batStats?.runs ?? null;
    }

    // --- Best spell: highest bowling_points player ---
    const bestSpellRows = await client
      .selectFrom("fantasy_player_score as fps")
      .innerJoin("fantasy_player as fp", "fp.play_cricket_id", "fps.play_cricket_id")
      .where("fps.season", "=", currentSeason)
      .where("fps.gameweek_id", "=", targetGameweek)
      .where("fps.bowling_points", ">", 0)
      .select([
        "fps.play_cricket_id",
        "fp.player_name",
        sql<number>`SUM(fps.bowling_points)`.as("bowling_points"),
        sql<number>`SUM(fps.total_points)`.as("total_points"),
      ])
      .groupBy("fps.play_cricket_id")
      .orderBy(sql`SUM(fps.bowling_points)`, "desc")
      .limit(1)
      .execute();

    // Fetch raw bowling stats for best spell
    let bestSpellStats: { wickets: number; runs: number } | null = null;
    if (bestSpellRows[0]) {
      const bowlStats = await client
        .selectFrom("match_performance_bowling as mpb")
        .innerJoin("fantasy_player_score as fps", (join) =>
          join
            .onRef("fps.play_cricket_id", "=", "mpb.player_id")
            .onRef("fps.match_id", "=", "mpb.match_id"),
        )
        .where("fps.season", "=", currentSeason)
        .where("fps.gameweek_id", "=", targetGameweek)
        .where("fps.play_cricket_id", "=", bestSpellRows[0].play_cricket_id)
        .select([
          sql<number>`SUM(mpb.wickets)`.as("wickets"),
          sql<number>`SUM(mpb.runs)`.as("runs"),
        ])
        .executeTakeFirst();

      if (bowlStats) {
        bestSpellStats = {
          wickets: bowlStats.wickets,
          runs: bowlStats.runs,
        };
      }
    }

    // --- Ownership data (used for shock, most captained, differential) ---
    const { ownershipMap, teamCount } = await getOwnershipData(currentSeason, targetGameweek);

    // Get all player scores for the gameweek
    const allPlayerScores = await client
      .selectFrom("fantasy_player_score as fps")
      .innerJoin("fantasy_player as fp", "fp.play_cricket_id", "fps.play_cricket_id")
      .where("fps.season", "=", currentSeason)
      .where("fps.gameweek_id", "=", targetGameweek)
      .select([
        "fps.play_cricket_id",
        "fp.player_name",
        sql<number>`SUM(fps.total_points)`.as("total_points"),
      ])
      .groupBy("fps.play_cricket_id")
      .orderBy(sql`SUM(fps.total_points)`, "desc")
      .execute();

    // --- Fantasy shock: highest scoring player with fewest owners ---
    type ShockEntry = {
      playerName: string;
      playCricketId: string;
      totalPoints: number;
      ownerCount: number;
      ownershipPct: number;
    };
    let fantasyShock: ShockEntry | null = null;

    if (allPlayerScores.length > 0 && teamCount > 0) {
      const topPoints = allPlayerScores[0]?.total_points ?? 0;
      const threshold = topPoints * 0.5;
      let bestShock: ShockEntry | null = null;
      for (const ps of allPlayerScores) {
        if (ps.total_points < threshold) break;
        const ownership = ownershipMap.get(ps.play_cricket_id);
        const owners = ownership?.ownerCount ?? 0;
        if (
          !bestShock ||
          owners < bestShock.ownerCount ||
          (owners === bestShock.ownerCount && ps.total_points > bestShock.totalPoints)
        ) {
          bestShock = {
            playerName: ps.player_name,
            playCricketId: ps.play_cricket_id,
            totalPoints: ps.total_points,
            ownerCount: owners,
            ownershipPct: ownership?.ownershipPct ?? 0,
          };
        }
      }
      if (bestShock && topScorerRows[0] && bestShock.playCricketId !== topScorerRows[0].play_cricket_id) {
        fantasyShock = bestShock;
      }
    }

    // --- Most captained player ---
    let mostCaptained: { playerName: string; playCricketId: string; captainPct: number } | null = null;
    if (teamCount > 0) {
      // Find the player with the highest captain count across all owned players
      let bestCaptainId: string | null = null;
      let bestCaptainCount = 0;
      let bestCaptainPct = 0;
      for (const [id, entry] of ownershipMap) {
        if (entry.captainCount > bestCaptainCount) {
          bestCaptainId = id;
          bestCaptainCount = entry.captainCount;
          bestCaptainPct = entry.captainPct;
        }
      }
      // Resolve player name independently from scores (captain may have 0 points)
      if (bestCaptainId && bestCaptainCount > 0) {
        const captainPlayer = await client
          .selectFrom("fantasy_player")
          .where("play_cricket_id", "=", bestCaptainId)
          .select("player_name")
          .executeTakeFirst();
        if (captainPlayer) {
          mostCaptained = { playerName: captainPlayer.player_name, playCricketId: bestCaptainId, captainPct: bestCaptainPct };
        }
      }
    }

    // --- Differential pick: best value low-ownership player this gameweek ---
    let differentialPick: { playerName: string; playCricketId: string; totalPoints: number; ownershipPct: number } | null = null;
    if (allPlayerScores.length > 0 && teamCount > 0) {
      const gwPointsMap = new Map<string, { playerName: string; points: number }>();
      for (const ps of allPlayerScores) {
        gwPointsMap.set(ps.play_cricket_id, { playerName: ps.player_name, points: ps.total_points });
      }
      const topDiff = rankDifferentials(ownershipMap, teamCount, gwPointsMap, 1);
      if (topDiff[0]) {
        differentialPick = {
          playerName: topDiff[0].playerName,
          playCricketId: topDiff[0].playCricketId,
          totalPoints: topDiff[0].points,
          ownershipPct: topDiff[0].ownershipPct,
        };
      }
    }

    // --- Top team: highest fantasy_team_score for this gameweek ---
    const topTeamRow = await client
      .selectFrom("fantasy_team_score as fts")
      .innerJoin("fantasy_team as ft", "ft.id", "fts.fantasy_team_id")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("fts.season", "=", currentSeason)
      .where("fts.gameweek_id", "=", targetGameweek)
      .select([
        "fts.fantasy_team_id",
        "fts.total_points",
        "u.name as ownerName",
      ])
      .orderBy("fts.total_points", "desc")
      .limit(1)
      .executeTakeFirst();

    // --- Biggest mover: largest rank improvement from previous gameweek ---
    let biggestMover: {
      ownerName: string;
      teamId: number | null;
      rankChange: number;
      currentRank: number;
      previousRank: number;
    } | null = null;

    if (targetGameweek > 1) {
      // Get cumulative scores for current and previous gameweek
      const currentCumulative = await client
        .selectFrom("fantasy_team_score as fts")
        .innerJoin("fantasy_team as ft", "ft.id", "fts.fantasy_team_id")
        .innerJoin("user as u", "u.id", "ft.user_id")
        .where("fts.season", "=", currentSeason)
        .where("fts.gameweek_id", "<=", targetGameweek)
        .select([
          "fts.fantasy_team_id",
          sql<number>`SUM(fts.total_points)`.as("cumulative_points"),
          "u.name as ownerName",
        ])
        .groupBy("fts.fantasy_team_id")
        .orderBy(sql`SUM(fts.total_points)`, "desc")
        .execute();

      const previousCumulative = await client
        .selectFrom("fantasy_team_score as fts")
        .innerJoin("fantasy_team as ft", "ft.id", "fts.fantasy_team_id")
        .where("fts.season", "=", currentSeason)
        .where("fts.gameweek_id", "<=", targetGameweek - 1)
        .select([
          "fts.fantasy_team_id",
          sql<number>`SUM(fts.total_points)`.as("cumulative_points"),
        ])
        .groupBy("fts.fantasy_team_id")
        .orderBy(sql`SUM(fts.total_points)`, "desc")
        .execute();

      // Assign ranks
      const currentRanked = assignRanks(
        currentCumulative.map((e) => ({
          teamId: e.fantasy_team_id,
          ownerName: e.ownerName,
          points: e.cumulative_points,
        })),
        (e) => e.points,
      );

      const previousRanked = assignRanks(
        previousCumulative.map((e) => ({
          teamId: e.fantasy_team_id,
          points: e.cumulative_points,
        })),
        (e) => e.points,
      );

      const prevRankMap = new Map<number | null, number>();
      for (const entry of previousRanked) {
        prevRankMap.set(entry.teamId, entry.rank);
      }

      let bestChange = 0;
      for (const entry of currentRanked) {
        const prevRank = prevRankMap.get(entry.teamId);
        if (prevRank !== undefined) {
          const change = prevRank - entry.rank;
          if (change > bestChange) {
            bestChange = change;
            biggestMover = {
              ownerName: entry.ownerName,
              teamId: entry.teamId,
              rankChange: change,
              currentRank: entry.rank,
              previousRank: prevRank,
            };
          }
        }
      }
    }

    return {
      highlights: {
        topScorer: topScorerRows[0]
          ? {
              playerName: topScorerRows[0].player_name,
              playCricketId: topScorerRows[0].play_cricket_id,
              totalPoints: topScorerRows[0].total_points,
              battingRuns: topScorerBattingRuns,
            }
          : null,
        bestSpell: bestSpellRows[0]
          ? {
              playerName: bestSpellRows[0].player_name,
              playCricketId: bestSpellRows[0].play_cricket_id,
              bowlingPoints: bestSpellRows[0].bowling_points,
              totalPoints: bestSpellRows[0].total_points,
              wickets: bestSpellStats?.wickets ?? null,
              runsConceded: bestSpellStats?.runs ?? null,
            }
          : null,
        fantasyShock,
        topTeam: topTeamRow
          ? {
              teamId: topTeamRow.fantasy_team_id,
              ownerName: topTeamRow.ownerName,
              totalPoints: topTeamRow.total_points,
            }
          : null,
        biggestMover,
        mostCaptained,
        differentialPick,
        teamCount,
      },
      gameweek: targetGameweek,
      season: currentSeason,
    };
  },
});

/**
 * Sandwich Efficiency — Points Per Sandwich (PPS) leaderboard.
 *
 * Public action: calculates total_points / sandwich_cost for each player
 * who has scored in the given season. In pre-season, defaults to the
 * previous season so there's always something to show.
 *
 * Uses fantasy_player_score when available (current season), falling back
 * to calculateSeasonPoints() from raw match data for previous seasons
 * where no fantasy scoring rows exist.
 */
const getSandwichEfficiency = defineAction({
  input: z.object({
    season: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(5),
  }),
  handler: async ({ season, limit }) => {
    const currentSeason = season ?? getCurrentSeason();
    const preseason = isPreSeason(currentSeason);

    // In pre-season, show previous season stats
    const effectiveSeason = preseason
      ? (Number(currentSeason) - 1).toString()
      : currentSeason;

    // Get eligible player names and sandwich costs
    const players = await client
      .selectFrom("fantasy_player")
      .where("eligible", "=", 1)
      .select(["play_cricket_id", "player_name", "sandwich_cost"])
      .execute();

    const playerMap = new Map(
      players.map((p) => [p.play_cricket_id, p]),
    );

    // Try fantasy_player_score first (works for current season).
    // Fall back to calculateSeasonPoints from raw match data (needed
    // for previous seasons where no fantasy scoring rows exist).
    const scoreRows = await client
      .selectFrom("fantasy_player_score")
      .where("season", "=", effectiveSeason)
      .groupBy("play_cricket_id")
      .select([
        "play_cricket_id",
        sql<number>`SUM(total_points)`.as("total_points"),
        sql<number>`COUNT(DISTINCT match_id)`.as("matches_played"),
      ])
      .having(sql`SUM(total_points)`, ">", 0)
      .execute();

    let playerPoints: Array<{
      playCricketId: string | null;
      totalPoints: number;
      matchesPlayed: number;
    }>;

    if (scoreRows.length > 0) {
      playerPoints = scoreRows.map((r) => ({
        playCricketId: r.play_cricket_id,
        totalPoints: r.total_points,
        matchesPlayed: r.matches_played,
      }));
    } else {
      // Fall back to raw match performance data
      const seasonNum = Number(effectiveSeason);
      const pointsMap = await calculateSeasonPoints([seasonNum]);
      playerPoints = [];
      for (const [playerId, seasonMap] of pointsMap) {
        const sp = seasonMap.get(seasonNum);
        if (sp && sp.totalPoints > 0) {
          playerPoints.push({
            playCricketId: playerId,
            totalPoints: sp.totalPoints,
            matchesPlayed: sp.matchesPlayed,
          });
        }
      }
    }

    const entries = playerPoints
      .filter((r) => playerMap.has(r.playCricketId))
      .map((r) => {
        // Safe: filtered to only include players in playerMap above
        const player = playerMap.get(r.playCricketId);
        const cost = player && player.sandwich_cost > 0 ? player.sandwich_cost : 1;
        return {
          playCricketId: r.playCricketId,
          playerName: player?.player_name ?? "Unknown",
          sandwichCost: cost,
          totalPoints: r.totalPoints,
          matchesPlayed: r.matchesPlayed,
          pointsPerSandwich: Math.round((r.totalPoints / cost) * 10) / 10,
        };
      })
      .sort((a, b) => b.pointsPerSandwich - a.pointsPerSandwich);

    return {
      season: effectiveSeason,
      isFromPreviousSeason: preseason,
      entries: assignRanks(entries, (e) => e.pointsPerSandwich).slice(0, limit),
    };
  },
});

/**
 * Public pre-season stats for the fantasy home page countdown display.
 * Returns team count and total sandwich cost across all teams.
 */
const getPreSeasonStats = defineAction({
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();

    const teamCount = await client
      .selectFrom("fantasy_team")
      .where("season", "=", currentSeason)
      .select(sql<number>`COUNT(*)`.as("count"))
      .executeTakeFirstOrThrow();

    const sandwichTotal = await client
      .selectFrom("fantasy_team_player as ftp")
      .innerJoin("fantasy_team as ft", "ft.id", "ftp.fantasy_team_id")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "ftp.play_cricket_id",
      )
      .where("ft.season", "=", currentSeason)
      .where("ftp.gameweek_removed", "is", null)
      .select(sql<number>`COALESCE(SUM(fp.sandwich_cost), 0)`.as("total"))
      .executeTakeFirstOrThrow();

    return {
      teamCount: teamCount.count,
      totalSandwiches: sandwichTotal.total,
    };
  },
});

/**
 * Public transfer window info for the fantasy home page.
 */
const getTransferWindowPublic = defineAction({
  input: z.object({
    season: z.string().optional(),
  }),
  handler: ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();
    return getTransferWindowInfo(currentSeason);
  },
});

/**
 * Public ownership overview for the fantasy home page.
 * Returns top 5 most owned, top 5 most captained, and differentials.
 */
const getOwnershipOverview = defineAction({
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();
    const gameweek = getCurrentGameweek(currentSeason);

    const { ownershipMap, teamCount } = await getOwnershipData(currentSeason, gameweek);

    if (teamCount === 0) {
      return { mostOwned: [], mostCaptained: [], differentials: [], teamCount: 0, gameweek };
    }

    // Get player names and sandwich costs for all players in the ownership map
    const playerIds = Array.from(ownershipMap.keys());
    const playerInfo = playerIds.length > 0
      ? await client
          .selectFrom("fantasy_player")
          .where("play_cricket_id", "in", playerIds)
          .select(["play_cricket_id", "player_name", "sandwich_cost"])
          .execute()
      : [];

    const nameMap = new Map<string, string>();
    const costMap = new Map<string, number>();
    for (const p of playerInfo) {
      if (p.play_cricket_id) {
        nameMap.set(p.play_cricket_id, p.player_name);
        costMap.set(p.play_cricket_id, p.sandwich_cost);
      }
    }

    // Build sorted arrays
    const entries = Array.from(ownershipMap.entries())
      .map(([id, data]) => ({
        playCricketId: id,
        playerName: nameMap.get(id) ?? "Unknown",
        ...data,
      }));

    const mostOwned = [...entries]
      .sort((a, b) => b.ownerCount - a.ownerCount || a.playerName.localeCompare(b.playerName))
      .slice(0, 5)
      .map(({ playCricketId, playerName, ownershipPct }) => ({ playCricketId, playerName, ownershipPct }));

    const mostCaptained = [...entries]
      .filter((e) => e.captainCount > 0)
      .sort((a, b) => b.captainCount - a.captainCount || a.playerName.localeCompare(b.playerName))
      .slice(0, 5)
      .map(({ playCricketId, playerName, captainPct }) => ({ playCricketId, playerName, captainPct }));

    // Build a points map for differentials ranking.
    // Use last completed gameweek's fantasy scores if available,
    // otherwise fall back to previous season match performance data.
    const diffPointsMap = new Map<string, { playerName: string; points: number }>();

    const lastCompletedGw = Math.max(0, gameweek - 1);
    if (lastCompletedGw > 0) {
      const gwScores = await client
        .selectFrom("fantasy_player_score as fps")
        .innerJoin("fantasy_player as fp", "fp.play_cricket_id", "fps.play_cricket_id")
        .where("fps.season", "=", currentSeason)
        .where("fps.gameweek_id", "=", lastCompletedGw)
        .select([
          "fps.play_cricket_id",
          "fp.player_name",
          sql<number>`SUM(fps.total_points)`.as("total_points"),
        ])
        .groupBy("fps.play_cricket_id")
        .execute();

      for (const row of gwScores) {
        diffPointsMap.set(row.play_cricket_id, { playerName: row.player_name, points: row.total_points });
      }
    }

    // Fall back to previous season totals from raw match data
    if (diffPointsMap.size === 0 || lastCompletedGw === 0) {
      const previousSeason = Number(currentSeason) - 1;
      const prevSeasonPoints = await calculateSeasonPoints([previousSeason]);

      for (const [playerId, seasonMap] of prevSeasonPoints) {
        if (diffPointsMap.has(playerId)) continue;
        const pts = seasonMap.get(previousSeason);
        if (pts && pts.totalPoints > 0) {
          diffPointsMap.set(playerId, {
            playerName: nameMap.get(playerId) ?? "Unknown",
            points: pts.totalPoints,
          });
        }
      }
    }

    const differentials = rankDifferentials(ownershipMap, teamCount, diffPointsMap, 5, costMap);

    return { mostOwned, mostCaptained, differentials, teamCount, gameweek };
  },
});

// ---------------------------------------------------------------------------
// Chip actions
// ---------------------------------------------------------------------------

const activateChip = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    chipType: z.enum(CHIP_TYPES as [ChipType, ...ChipType[]]),
    season: z.string().optional(),
  }),
  handler: async ({ chipType, season }, session) => {
    const currentSeason = season ?? getCurrentSeason();

    if (isGameweekLocked(currentSeason)) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Cannot activate chips during locked weekends.",
      });
    }

    const gameweek = getCurrentGameweek(currentSeason);
    if (gameweek === 0) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Cannot activate chips during pre-season.",
      });
    }

    const team = await client
      .selectFrom("fantasy_team")
      .where("user_id", "=", session.user.id)
      .where("season", "=", currentSeason)
      .select("id")
      .executeTakeFirst();

    if (!team) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "You need a team before activating a chip.",
      });
    }

    const teamId = requireId(team.id);
    const chipConfig = CHIPS[chipType];

    // Check season usage limit
    const usedThisSeason = await client
      .selectFrom("fantasy_chip_usage")
      .where("fantasy_team_id", "=", teamId)
      .where("chip_type", "=", chipType)
      .where("season", "=", currentSeason)
      .select(sql<number>`COUNT(*)`.as("count"))
      .executeTakeFirst();

    if ((usedThisSeason?.count ?? 0) >= chipConfig.usesPerSeason) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: `You have already used all ${chipConfig.usesPerSeason} ${chipType.replace("_", " ")} chips this season.`,
      });
    }

    // Insert (unique constraint will prevent double-activation for same gameweek)
    try {
      await client
        .insertInto("fantasy_chip_usage")
        .values({
          fantasy_team_id: teamId,
          chip_type: chipType,
          gameweek_id: gameweek,
          season: currentSeason,
        })
        .execute();
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `${chipType.replace("_", " ")} chip is already active for this gameweek.`,
        });
      }
      throw err;
    }

    return { success: true };
  },
});

const deactivateChip = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    chipType: z.enum(CHIP_TYPES as [ChipType, ...ChipType[]]),
    season: z.string().optional(),
  }),
  handler: async ({ chipType, season }, session) => {
    const currentSeason = season ?? getCurrentSeason();
    const gameweek = getCurrentGameweek(currentSeason);

    if (gameweek === 0) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Cannot deactivate chips during pre-season.",
      });
    }

    if (isGameweekLocked(currentSeason)) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Cannot deactivate chips during locked weekends.",
      });
    }

    const team = await client
      .selectFrom("fantasy_team")
      .where("user_id", "=", session.user.id)
      .where("season", "=", currentSeason)
      .select("id")
      .executeTakeFirst();

    if (!team) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Team not found.",
      });
    }

    const teamId = requireId(team.id);

    const deleted = await client
      .deleteFrom("fantasy_chip_usage")
      .where("fantasy_team_id", "=", teamId)
      .where("chip_type", "=", chipType)
      .where("gameweek_id", "=", gameweek)
      .where("season", "=", currentSeason)
      .execute();

    if (deleted[0] && Number(deleted[0].numDeletedRows) === 0) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "No active chip found for this gameweek.",
      });
    }

    return { success: true };
  },
});

const getChipStatus = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }, session) => {
    const currentSeason = season ?? getCurrentSeason();
    const gameweek = getCurrentGameweek(currentSeason);

    const team = await client
      .selectFrom("fantasy_team")
      .where("user_id", "=", session.user.id)
      .where("season", "=", currentSeason)
      .select("id")
      .executeTakeFirst();

    if (!team) {
      return {
        chips: CHIP_TYPES.map((type) => ({
          chipType: type,
          usedThisSeason: 0,
          maxPerSeason: CHIPS[type].usesPerSeason,
          activeThisGameweek: false,
        })),
        gameweek,
      };
    }

    const teamId = requireId(team.id);

    const usages = await client
      .selectFrom("fantasy_chip_usage")
      .where("fantasy_team_id", "=", teamId)
      .where("season", "=", currentSeason)
      .select(["chip_type", "gameweek_id"])
      .execute();

    const chipStatus = CHIP_TYPES.map((type) => {
      const usedCount = usages.filter((u) => u.chip_type === type).length;
      const activeThisGw = usages.some(
        (u) => u.chip_type === type && u.gameweek_id === gameweek,
      );
      return {
        chipType: type,
        usedThisSeason: usedCount,
        maxPerSeason: CHIPS[type].usesPerSeason,
        activeThisGameweek: activeThisGw,
      };
    });

    return { chips: chipStatus, gameweek };
  },
});

// ---------------------------------------------------------------------------
// Chaos weeks
// ---------------------------------------------------------------------------

/**
 * Get the active chaos week for a given season and gameweek.
 * Returns null if no chaos week is active.
 */
async function getActiveChaosWeek(season: string, gameweek: number) {
  if (gameweek === 0) return null;
  return (
    (await client
      .selectFrom("fantasy_chaos_week")
      .where("season", "=", season)
      .where("gameweek_id", "=", gameweek)
      .selectAll()
      .executeTakeFirst()) ?? null
  );
}

const getChaosWeekPublic = defineAction({
  input: z.object({
    season: z.string().optional(),
    gameweek: z.number().optional(),
  }),
  handler: async ({ season, gameweek }) => {
    const s = season ?? getCurrentSeason();
    const gw = gameweek ?? getCurrentGameweek(s);
    return getActiveChaosWeek(s, gw);
  },
});

const listChaosWeeks = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const s = season ?? getCurrentSeason();
    const weeks = await client
      .selectFrom("fantasy_chaos_week")
      .where("season", "=", s)
      .orderBy("gameweek_id", "asc")
      .selectAll()
      .execute();
    return { weeks, season: s };
  },
});

const createChaosWeek = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    season: z.string().optional(),
    gameweekId: z.number().min(1),
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    ruleType: z.enum(CHAOS_RULE_TYPES as unknown as [string, ...string[]]),
    ruleConfig: z.string().optional(),
    sendEmail: z.boolean().optional(),
  }),
  handler: async ({
    season,
    gameweekId,
    name,
    description,
    ruleType,
    ruleConfig,
    sendEmail,
  }) => {
    const s = season ?? getCurrentSeason();

    // Validate rule config is valid JSON if provided
    if (ruleConfig) {
      try {
        JSON.parse(ruleConfig);
      } catch {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Rule config must be valid JSON.",
        });
      }
    }

    // Check for existing chaos week in this gameweek
    const existing = await client
      .selectFrom("fantasy_chaos_week")
      .where("season", "=", s)
      .where("gameweek_id", "=", gameweekId)
      .select("id")
      .executeTakeFirst();

    if (existing) {
      throw new ActionError({
        code: "CONFLICT",
        message: `A chaos week already exists for gameweek ${gameweekId}.`,
      });
    }

    const result = await client
      .insertInto("fantasy_chaos_week")
      .values({
        season: s,
        gameweek_id: gameweekId,
        name,
        description,
        rule_type: ruleType,
        rule_config: ruleConfig ?? "{}",
        send_email: sendEmail === false ? 0 : 1,
        email_sent: 0,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return { id: result.id, season: s, gameweekId };
  },
});

const updateChaosWeek = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    id: z.number(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(500).optional(),
    ruleType: z
      .enum(CHAOS_RULE_TYPES as unknown as [string, ...string[]])
      .optional(),
    ruleConfig: z.string().optional(),
    sendEmail: z.boolean().optional(),
  }),
  handler: async ({ id, name, description, ruleType, ruleConfig, sendEmail }) => {
    if (ruleConfig) {
      try {
        JSON.parse(ruleConfig);
      } catch {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Rule config must be valid JSON.",
        });
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (ruleType !== undefined) updates.rule_type = ruleType;
    if (ruleConfig !== undefined) updates.rule_config = ruleConfig;
    if (sendEmail !== undefined) updates.send_email = sendEmail ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "No fields to update.",
      });
    }

    await client
      .updateTable("fantasy_chaos_week")
      .set(updates)
      .where("id", "=", id)
      .execute();

    return { success: true };
  },
});

const deleteChaosWeek = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    id: z.number(),
  }),
  handler: async ({ id }) => {
    await client
      .deleteFrom("fantasy_chaos_week")
      .where("id", "=", id)
      .execute();
    return { success: true };
  },
});

const sendChaosWeekEmail = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    id: z.number(),
  }),
  handler: async ({ id }) => {
    const chaosWeek = await client
      .selectFrom("fantasy_chaos_week")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirst();

    if (!chaosWeek) {
      throw new ActionError({
        code: "NOT_FOUND",
        message: "Chaos week not found.",
      });
    }

    if (chaosWeek.email_sent === 1) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Email has already been sent for this chaos week.",
      });
    }

    // Get all fantasy team managers for this season
    const teams = await client
      .selectFrom("fantasy_team as ft")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("ft.season", "=", chaosWeek.season)
      .select(["u.name", "u.email"])
      .execute();

    const siteUrl =
      process.env.DEPLOY_PRIME_URL ??
      process.env.URL ??
      "https://percymain.org";
    const imageBaseUrl = `${siteUrl}/images`;

    let sent = 0;
    for (const team of teams) {
      try {
        const html = await render(
          createElement(ChaosWeekAnnouncement.component, {
            imageBaseUrl,
            name: team.name ?? "there",
            chaosName: chaosWeek.name,
            chaosDescription: chaosWeek.description,
            gameweek: chaosWeek.gameweek_id,
            fantasyUrl: `${siteUrl}/members/fantasy`,
          }),
        );
        await send({
          to: team.email,
          subject: ChaosWeekAnnouncement.subject,
          html,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send chaos week email to ${team.email}:`, err);
      }
    }

    // Mark as sent
    await client
      .updateTable("fantasy_chaos_week")
      .set({ email_sent: 1 })
      .where("id", "=", id)
      .execute();

    return { sent, total: teams.length };
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const fantasy = {
  listPlayers,
  toggleEligibility,
  populatePlayers,
  calculateSandwichCosts,
  calculateScores,
  getEligiblePlayers,
  getMyTeam,
  saveTeam,
  getTeam,
  getTeamShareData,
  listTeams,
  getTransferWindow,
  getWeeklyLeaderboard,
  getSeasonLeaderboard,
  getPlayerLeaderboard,
  getGameweekDetail,
  getSeasonTimeline,
  getPlayerHistory,
  getPreSeasonStats,
  getTransferWindowPublic,
  activateChip,
  deactivateChip,
  getChipStatus,
  getGameweekHighlights,
  getOwnershipOverview,
  getSandwichEfficiency,
  getChaosWeekPublic,
  listChaosWeeks,
  createChaosWeek,
  updateChaosWeek,
  deleteChaosWeek,
  sendChaosWeekEmail,
};
