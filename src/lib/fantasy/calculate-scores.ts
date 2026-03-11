/**
 * Fantasy scoring calculation engine.
 *
 * Calculates and stores per-player and per-team fantasy scores
 * for each gameweek based on match performance data.
 *
 * Designed to be idempotent — safe to re-run at any time.
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
} from "./scoring";
import { getGW1StartDate } from "./gameweek";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a DD/MM/YYYY date string (as stored in match_performance tables)
 * into a Date object.
 */
function parseMatchDate(ddmmyyyy: string): Date {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return new Date(
    parseInt(yyyy ?? "0"),
    parseInt(mm ?? "1") - 1,
    parseInt(dd ?? "1"),
  );
}

/**
 * Determine which gameweek a match date falls in for a given season.
 * Returns 0 for pre-season matches (before GW1).
 * Returns null if the match is outside the season entirely.
 */
function getGameweekForDate(matchDate: Date, season: string): number | null {
  const gw1 = getGW1StartDate(season);

  if (matchDate.getTime() < gw1.getTime()) return null; // Before season starts

  const diffMs = matchDate.getTime() - gw1.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
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
 * 3. Upserts into fantasy_player_score
 * 4. Aggregates team scores (captain 2x) into fantasy_team_score
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

  // Calculate and upsert player scores
  let playerScoresUpserted = 0;

  for (const [, app] of appearances) {
    const matchDate = parseMatchDate(app.matchDate);
    const gameweek = getGameweekForDate(matchDate, season);
    if (gameweek === null || gameweek === 0) continue; // Skip pre-season matches

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

    await db
      .insertInto("fantasy_player_score")
      .values({
        gameweek_id: gameweek,
        play_cricket_id: app.playerId,
        match_id: app.matchId,
        batting_points: battingPts,
        bowling_points: bowlingPts,
        fielding_points: fieldingPts,
        team_points: teamPts,
        total_points: totalPts,
        season,
      })
      .onConflict((oc) =>
        oc
          .columns(["gameweek_id", "play_cricket_id", "match_id"])
          .doUpdateSet({
            batting_points: battingPts,
            bowling_points: bowlingPts,
            fielding_points: fieldingPts,
            team_points: teamPts,
            total_points: totalPts,
          }),
      )
      .execute();

    playerScoresUpserted++;
  }

  // Now calculate team scores
  // For each fantasy team, for each gameweek, sum up the scores of
  // active squad members, applying 2x for captain
  const teams = await db
    .selectFrom("fantasy_team")
    .where("season", "=", season)
    .select(["id", "season"])
    .execute();

  let teamScoresUpserted = 0;

  // Find all gameweeks that have player scores
  const gameweeksResult = await db
    .selectFrom("fantasy_player_score")
    .where("season", "=", season)
    .select("gameweek_id")
    .distinct()
    .execute();

  const gameweeks = gameweeksResult.map((r) => r.gameweek_id);

  for (const team of teams) {
    const teamId = team.id;
    if (teamId === null) continue;

    // Get all team player assignments (for determining active squad per gameweek)
    const teamPlayers = await db
      .selectFrom("fantasy_team_player")
      .where("fantasy_team_id", "=", teamId)
      .select(["play_cricket_id", "is_captain", "gameweek_added", "gameweek_removed"])
      .execute();

    for (const gw of gameweeks) {
      // Determine active squad for this gameweek
      const activePlayers = teamPlayers.filter(
        (p) =>
          p.gameweek_added <= gw &&
          (p.gameweek_removed === null || p.gameweek_removed > gw),
      );

      if (activePlayers.length === 0) continue;

      // Get player scores for this gameweek
      const playerIds = activePlayers.map((p) => p.play_cricket_id);
      const playerScores = await db
        .selectFrom("fantasy_player_score")
        .where("gameweek_id", "=", gw)
        .where("season", "=", season)
        .where("play_cricket_id", "in", playerIds)
        .select(["play_cricket_id", "total_points"])
        .execute();

      // Sum scores per player (a player could have multiple matches in a gameweek)
      const scoreByPlayer = new Map<string, number>();
      for (const ps of playerScores) {
        scoreByPlayer.set(
          ps.play_cricket_id,
          (scoreByPlayer.get(ps.play_cricket_id) ?? 0) + ps.total_points,
        );
      }

      // Calculate team total with captain 2x multiplier
      let totalPoints = 0;
      for (const player of activePlayers) {
        const playerPoints = scoreByPlayer.get(player.play_cricket_id) ?? 0;
        const multiplier = player.is_captain === 1 ? 2 : 1;
        totalPoints += playerPoints * multiplier;
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
          oc.columns(["gameweek_id", "fantasy_team_id"]).doUpdateSet({
            total_points: totalPoints,
          }),
        )
        .execute();

      teamScoresUpserted++;
    }
  }

  return { playerScoresUpserted, teamScoresUpserted };
}
