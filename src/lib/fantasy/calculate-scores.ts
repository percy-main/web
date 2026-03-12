/**
 * Fantasy scoring calculation engine.
 *
 * Calculates and stores per-player and per-team fantasy scores
 * for each gameweek based on match performance data.
 *
 * Designed to be idempotent — safe to re-run at any time.
 *
 * Team scoring is slot-based: batting slots only earn batting+fielding+team,
 * bowling slots only earn bowling+fielding+team, and the all-rounder slot
 * earns all categories. The wicketkeeper designation adjusts catch rates.
 */

import { type Kysely } from "kysely";
import type { DB } from "../db/__generated__/db";
import {
  calculateBattingPoints,
  calculateBowlingPoints,
  calculateFieldingPoints,
  ELIGIBLE_TEAM_IDS,
  LEAGUE_COMPETITION_TYPES,
  SCORING,
  type SlotType,
} from "./scoring";
import { getGW1StartDate } from "./gameweek";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a DD/MM/YYYY date string (as stored in match_performance tables)
 * into a UTC Date object.
 */
function parseMatchDate(ddmmyyyy: string): Date {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return new Date(
    Date.UTC(
      parseInt(yyyy ?? "0"),
      parseInt(mm ?? "1") - 1,
      parseInt(dd ?? "1"),
    ),
  );
}

/**
 * Determine which gameweek a match date falls in for a given season.
 * Returns null for pre-season matches (before GW1 start date).
 */
function getGameweekForDate(matchDate: Date, season: string): number | null {
  const gw1 = getGW1StartDate(season);

  if (matchDate.getTime() < gw1.getTime()) return null;

  const diffMs = matchDate.getTime() - gw1.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

/**
 * Calculate effective team points for a player based on their slot type,
 * wicketkeeper designation, and raw per-category scores.
 *
 * Slot filtering:
 *   batting   → batting + fielding + team
 *   bowling   → bowling + fielding + team
 *   allrounder → batting + bowling + fielding + team
 *
 * WK adjustment: if fantasy WK tag differs from actual keeper status,
 * adjust fielding points for the catch rate difference.
 */
export function calculateSlotEffectivePoints(opts: {
  slotType: SlotType;
  isFantasyWk: boolean;
  battingPts: number;
  bowlingPts: number;
  fieldingPts: number;
  teamPts: number;
  catches: number;
  isActualKeeper: boolean;
  isCaptain: boolean;
}): number {
  const { slotType, isFantasyWk, battingPts, bowlingPts, teamPts, catches, isActualKeeper, isCaptain } = opts;
  let { fieldingPts } = opts;

  // WK adjustment: recalculate fielding based on fantasy WK tag vs actual
  if (isFantasyWk !== isActualKeeper && catches > 0) {
    if (isFantasyWk && !isActualKeeper) {
      // Fantasy WK but not actual keeper: catches were scored at 10pt, should be 5pt
      fieldingPts += catches * (SCORING.fielding.perCatchKeeper - SCORING.fielding.perCatch);
    } else if (!isFantasyWk && isActualKeeper) {
      // Not fantasy WK but is actual keeper: catches were scored at 5pt, should be 10pt
      fieldingPts += catches * (SCORING.fielding.perCatch - SCORING.fielding.perCatchKeeper);
    }
  }

  // Slot filtering
  let effective = 0;
  switch (slotType) {
    case "batting":
      effective = battingPts + fieldingPts + teamPts;
      break;
    case "bowling":
      effective = bowlingPts + fieldingPts + teamPts;
      break;
    case "allrounder":
      effective = battingPts + bowlingPts + fieldingPts + teamPts;
      break;
  }

  // Captain multiplier (allrounder can't be captain, validated at save)
  return effective * (isCaptain ? 2 : 1);
}

// ---------------------------------------------------------------------------
// Main scoring calculation
// ---------------------------------------------------------------------------

export interface CalculateScoresResult {
  playerScoresUpserted: number;
  teamScoresUpserted: number;
}

/**
 * Calculate and store fantasy scores for a given season.
 *
 * For each league match with a result:
 * 1. Maps the match to a gameweek
 * 2. Calculates per-player scores using the scoring engine
 * 3. Upserts into fantasy_player_score (with raw catches and keeper status)
 * 4. Aggregates team scores (slot-based + WK adjustment + captain 2x) into fantasy_team_score
 */
export async function calculateFantasyScores(
  db: Kysely<DB>,
  season: string,
): Promise<CalculateScoresResult> {
  const eligibleTeamIds = Array.from(ELIGIBLE_TEAM_IDS);
  const leagueTypes = Array.from(LEAGUE_COMPETITION_TYPES);
  const seasonNum = Number(season);

  // Fetch all match performance data and results for the season
  const [battingPerfs, bowlingPerfs, fieldingPerfs, matchResults] =
    await Promise.all([
      db
        .selectFrom("match_performance_batting")
        .where("season", "=", seasonNum)
        .where("team_id", "in", eligibleTeamIds)
        .where("competition_type", "in", leagueTypes)
        .select([
          "player_id",
          "match_id",
          "team_id",
          "match_date",
          "runs",
          "balls",
          "fours",
          "sixes",
          "not_out",
        ])
        .execute(),
      db
        .selectFrom("match_performance_bowling")
        .where("season", "=", seasonNum)
        .where("team_id", "in", eligibleTeamIds)
        .where("competition_type", "in", leagueTypes)
        .select([
          "player_id",
          "match_id",
          "team_id",
          "match_date",
          "overs",
          "maidens",
          "runs",
          "wickets",
        ])
        .execute(),
      db
        .selectFrom("match_performance_fielding")
        .where("season", "=", seasonNum)
        .where("team_id", "in", eligibleTeamIds)
        .where("competition_type", "in", leagueTypes)
        .select([
          "player_id",
          "match_id",
          "team_id",
          "match_date",
          "catches",
          "run_outs",
          "stumpings",
          "is_wicketkeeper",
        ])
        .execute(),
      db
        .selectFrom("match_result")
        .where("season", "=", seasonNum)
        .where("competition_type", "in", leagueTypes)
        .select(["match_id", "result_applied_to", "match_date"])
        .execute(),
    ]);

  // Build match result lookup: match_id -> { winnerTeamId, matchDate }
  const matchInfo = new Map<
    string,
    { winnerTeamId: string; matchDate: string }
  >();
  for (const r of matchResults) {
    matchInfo.set(r.match_id, {
      winnerTeamId: r.result_applied_to,
      matchDate: r.match_date,
    });
  }

  // Only score matches that have results
  const matchIdsWithResults = new Set(matchInfo.keys());

  // Index performances by "playerId:matchId"
  const mkKey = (playerId: string, matchId: string) =>
    `${playerId}:${matchId}`;

  const battingByMatch = new Map<string, (typeof battingPerfs)[0]>();
  for (const b of battingPerfs) {
    if (matchIdsWithResults.has(b.match_id)) {
      battingByMatch.set(mkKey(b.player_id, b.match_id), b);
    }
  }

  const bowlingByMatch = new Map<string, (typeof bowlingPerfs)[0]>();
  for (const b of bowlingPerfs) {
    if (matchIdsWithResults.has(b.match_id)) {
      bowlingByMatch.set(mkKey(b.player_id, b.match_id), b);
    }
  }

  const fieldingByMatch = new Map<string, (typeof fieldingPerfs)[0]>();
  for (const f of fieldingPerfs) {
    if (matchIdsWithResults.has(f.match_id)) {
      fieldingByMatch.set(mkKey(f.player_id, f.match_id), f);
    }
  }

  // Collect unique player-match appearances (only for matches with results)
  type Appearance = {
    playerId: string;
    matchId: string;
    teamId: string;
    matchDate: string;
  };
  const appearances = new Map<string, Appearance>();

  for (const b of battingPerfs) {
    if (!matchIdsWithResults.has(b.match_id)) continue;
    const k = mkKey(b.player_id, b.match_id);
    if (!appearances.has(k)) {
      appearances.set(k, {
        playerId: b.player_id,
        matchId: b.match_id,
        teamId: b.team_id,
        matchDate: b.match_date,
      });
    }
  }
  for (const b of bowlingPerfs) {
    if (!matchIdsWithResults.has(b.match_id)) continue;
    const k = mkKey(b.player_id, b.match_id);
    if (!appearances.has(k)) {
      appearances.set(k, {
        playerId: b.player_id,
        matchId: b.match_id,
        teamId: b.team_id,
        matchDate: b.match_date,
      });
    }
  }
  for (const f of fieldingPerfs) {
    if (!matchIdsWithResults.has(f.match_id)) continue;
    const k = mkKey(f.player_id, f.match_id);
    if (!appearances.has(k)) {
      appearances.set(k, {
        playerId: f.player_id,
        matchId: f.match_id,
        teamId: f.team_id,
        matchDate: f.match_date,
      });
    }
  }

  // Calculate player scores in memory first, then upsert
  type PlayerScore = {
    gameweek: number;
    playerId: string;
    matchId: string;
    battingPts: number;
    bowlingPts: number;
    fieldingPts: number;
    teamPts: number;
    totalPts: number;
    catches: number;
    isActualKeeper: boolean;
  };

  const playerScores: PlayerScore[] = [];

  for (const [, app] of appearances) {
    const matchDate = parseMatchDate(app.matchDate);
    const gameweek = getGameweekForDate(matchDate, season);
    if (gameweek === null) continue; // Skip pre-season matches

    const bat = battingByMatch.get(mkKey(app.playerId, app.matchId));
    const bowl = bowlingByMatch.get(mkKey(app.playerId, app.matchId));
    const field = fieldingByMatch.get(mkKey(app.playerId, app.matchId));

    const info = matchInfo.get(app.matchId);
    const teamWon = info?.winnerTeamId === app.teamId;

    const battingPts = bat
      ? calculateBattingPoints({
          runs: bat.runs,
          balls: bat.balls,
          fours: bat.fours,
          sixes: bat.sixes,
          notOut: bat.not_out === 1,
          battingPosition: SCORING.batting.duckPenaltyMaxPosition,
        }).total
      : 0;

    const bowlingPts = bowl
      ? calculateBowlingPoints({
          overs: bowl.overs,
          maidens: bowl.maidens,
          runs: bowl.runs,
          wickets: bowl.wickets,
        }).total
      : 0;

    const fieldingPts = field
      ? calculateFieldingPoints({
          catches: field.catches,
          runOuts: field.run_outs,
          stumpings: field.stumpings,
          isWicketkeeper: field.is_wicketkeeper === 1,
        }).total
      : 0;

    const teamPts = teamWon ? SCORING.team.winBonus : 0;
    const totalPts = battingPts + bowlingPts + fieldingPts + teamPts;

    playerScores.push({
      gameweek,
      playerId: app.playerId,
      matchId: app.matchId,
      battingPts,
      bowlingPts,
      fieldingPts,
      teamPts,
      totalPts,
      catches: field?.catches ?? 0,
      isActualKeeper: field?.is_wicketkeeper === 1,
    });
  }

  // Upsert player scores
  let playerScoresUpserted = 0;
  for (const ps of playerScores) {
    await db
      .insertInto("fantasy_player_score")
      .values({
        gameweek_id: ps.gameweek,
        play_cricket_id: ps.playerId,
        match_id: ps.matchId,
        batting_points: ps.battingPts,
        bowling_points: ps.bowlingPts,
        fielding_points: ps.fieldingPts,
        team_points: ps.teamPts,
        total_points: ps.totalPts,
        catches: ps.catches,
        is_actual_keeper: ps.isActualKeeper ? 1 : 0,
        season,
      })
      .onConflict((oc) =>
        oc
          .columns(["season", "gameweek_id", "play_cricket_id", "match_id"])
          .doUpdateSet({
            batting_points: ps.battingPts,
            bowling_points: ps.bowlingPts,
            fielding_points: ps.fieldingPts,
            team_points: ps.teamPts,
            total_points: ps.totalPts,
            catches: ps.catches,
            is_actual_keeper: ps.isActualKeeper ? 1 : 0,
          }),
      )
      .execute();
    playerScoresUpserted++;
  }

  // --- Team score calculation ---
  // Fetch all data upfront to avoid N+1 queries

  const teams = await db
    .selectFrom("fantasy_team")
    .where("season", "=", season)
    .select(["id", "season"])
    .execute();

  if (teams.length === 0) {
    return { playerScoresUpserted, teamScoresUpserted: 0 };
  }

  const teamIds = teams
    .map((t) => t.id)
    .filter((id): id is number => id !== null);

  // Fetch all team player assignments in one query (including slot and WK info)
  const allTeamPlayers = await db
    .selectFrom("fantasy_team_player")
    .where("fantasy_team_id", "in", teamIds)
    .select([
      "fantasy_team_id",
      "play_cricket_id",
      "is_captain",
      "gameweek_added",
      "gameweek_removed",
      "slot_type",
      "is_wicketkeeper",
    ])
    .execute();

  // Group by team
  const teamPlayersMap = new Map<number, typeof allTeamPlayers>();
  for (const tp of allTeamPlayers) {
    let arr = teamPlayersMap.get(tp.fantasy_team_id);
    if (!arr) {
      arr = [];
      teamPlayersMap.set(tp.fantasy_team_id, arr);
    }
    arr.push(tp);
  }

  // Find all gameweeks that have player scores
  const gameweeksResult = await db
    .selectFrom("fantasy_player_score")
    .where("season", "=", season)
    .select("gameweek_id")
    .distinct()
    .execute();

  const gameweeks = gameweeksResult.map((r) => r.gameweek_id);

  // Fetch all player scores for the season in one query (including per-category breakdowns)
  const allPlayerScoresForTeams = await db
    .selectFrom("fantasy_player_score")
    .where("season", "=", season)
    .select([
      "play_cricket_id",
      "gameweek_id",
      "batting_points",
      "bowling_points",
      "fielding_points",
      "team_points",
      "total_points",
      "catches",
      "is_actual_keeper",
    ])
    .execute();

  // Index: gameweek -> playerId -> aggregated category scores
  type PlayerGwScores = {
    battingPts: number;
    bowlingPts: number;
    fieldingPts: number;
    teamPts: number;
    totalPts: number;
    catches: number;
    isActualKeeper: boolean;
  };
  const scoresByGwAndPlayer = new Map<number, Map<string, PlayerGwScores>>();
  for (const ps of allPlayerScoresForTeams) {
    let gwMap = scoresByGwAndPlayer.get(ps.gameweek_id);
    if (!gwMap) {
      gwMap = new Map();
      scoresByGwAndPlayer.set(ps.gameweek_id, gwMap);
    }
    const existing = gwMap.get(ps.play_cricket_id);
    if (existing) {
      existing.battingPts += ps.batting_points;
      existing.bowlingPts += ps.bowling_points;
      existing.fieldingPts += ps.fielding_points;
      existing.teamPts += ps.team_points;
      existing.totalPts += ps.total_points;
      existing.catches += ps.catches;
      // If any match they were keeper, treat as actual keeper for the GW
      if (ps.is_actual_keeper === 1) existing.isActualKeeper = true;
    } else {
      gwMap.set(ps.play_cricket_id, {
        battingPts: ps.batting_points,
        bowlingPts: ps.bowling_points,
        fieldingPts: ps.fielding_points,
        teamPts: ps.team_points,
        totalPts: ps.total_points,
        catches: ps.catches,
        isActualKeeper: ps.is_actual_keeper === 1,
      });
    }
  }

  // Calculate and upsert team scores
  let teamScoresUpserted = 0;

  for (const teamId of teamIds) {
    const teamPlayers = teamPlayersMap.get(teamId) ?? [];

    for (const gw of gameweeks) {
      // Determine active squad for this gameweek
      const activePlayers = teamPlayers.filter(
        (p) =>
          p.gameweek_added <= gw &&
          (p.gameweek_removed === null || p.gameweek_removed > gw),
      );

      if (activePlayers.length === 0) continue;

      const gwScores = scoresByGwAndPlayer.get(gw) ?? new Map();

      // Calculate team total using slot-based scoring with WK adjustment
      let totalPoints = 0;
      for (const player of activePlayers) {
        const scores = gwScores.get(player.play_cricket_id);
        if (!scores) continue;

        totalPoints += calculateSlotEffectivePoints({
          slotType: (player.slot_type ?? "batting") as SlotType,
          isFantasyWk: player.is_wicketkeeper === 1,
          battingPts: scores.battingPts,
          bowlingPts: scores.bowlingPts,
          fieldingPts: scores.fieldingPts,
          teamPts: scores.teamPts,
          catches: scores.catches,
          isActualKeeper: scores.isActualKeeper,
          isCaptain: player.is_captain === 1,
        });
      }

      await db
        .insertInto("fantasy_team_score")
        .values({
          gameweek_id: gw,
          fantasy_team_id: teamId,
          total_points: totalPoints,
          season,
        })
        .onConflict((oc) =>
          oc
            .columns(["season", "gameweek_id", "fantasy_team_id"])
            .doUpdateSet({
              total_points: totalPoints,
            }),
        )
        .execute();

      teamScoresUpserted++;
    }
  }

  return { playerScoresUpserted, teamScoresUpserted };
}
