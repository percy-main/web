import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "../../db/__generated__/db";
import { calculateFantasyScores } from "../calculate-scores";

function createTestDb(): Kysely<DB> {
  const sqlite = new SQLite(":memory:");
  const db = new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  return db;
}

async function setupSchema(db: Kysely<DB>) {
  // Create tables needed for scoring
  await db.schema
    .createTable("fantasy_player")
    .addColumn("play_cricket_id", "text", (col) => col.primaryKey())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("eligible", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createTable("fantasy_team")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createTable("fantasy_team_player")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("fantasy_team_id", "integer", (col) => col.notNull())
    .addColumn("play_cricket_id", "text", (col) => col.notNull())
    .addColumn("is_captain", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("gameweek_added", "integer", (col) => col.notNull())
    .addColumn("gameweek_removed", "integer")
    .execute();

  await db.schema
    .createTable("match_performance_batting")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("team_id", "text", (col) => col.notNull())
    .addColumn("competition_type", "text", (col) => col.notNull().defaultTo("League"))
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("runs", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("balls", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("fours", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("sixes", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("how_out", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("not_out", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createTable("match_performance_bowling")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("team_id", "text", (col) => col.notNull())
    .addColumn("competition_type", "text", (col) => col.notNull().defaultTo("League"))
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("overs", "text", (col) => col.notNull().defaultTo("0"))
    .addColumn("maidens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("runs", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("wickets", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("wides", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("no_balls", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createTable("match_performance_fielding")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("team_id", "text", (col) => col.notNull())
    .addColumn("competition_type", "text", (col) => col.notNull().defaultTo("League"))
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("catches", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("run_outs", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("stumpings", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_wicketkeeper", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createTable("match_result")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("home_team_id", "text", (col) => col.notNull())
    .addColumn("away_team_id", "text", (col) => col.notNull())
    .addColumn("home_team_name", "text", (col) => col.notNull())
    .addColumn("away_team_name", "text", (col) => col.notNull())
    .addColumn("result", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("result_description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("result_applied_to", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("competition_type", "text", (col) => col.notNull().defaultTo("League"))
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createTable("fantasy_player_score")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("gameweek_id", "integer", (col) => col.notNull())
    .addColumn("play_cricket_id", "text", (col) => col.notNull())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("batting_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("bowling_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("fielding_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("team_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("total_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createIndex("idx_fps_gameweek_player_match")
    .on("fantasy_player_score")
    .columns(["season", "gameweek_id", "play_cricket_id", "match_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("fantasy_team_score")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("gameweek_id", "integer", (col) => col.notNull())
    .addColumn("fantasy_team_id", "integer", (col) => col.notNull())
    .addColumn("total_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createIndex("idx_fts_gameweek_team")
    .on("fantasy_team_score")
    .columns(["season", "gameweek_id", "fantasy_team_id"])
    .unique()
    .execute();
}

// Match date in GW1 (18/04/2026 is a Saturday, GW1 start)
const GW1_MATCH_DATE = "18/04/2026";
// Match date in GW2
const GW2_MATCH_DATE = "25/04/2026";

// Eligible team IDs (from scoring.ts)
const TEAM_1ST_XI = "68498";

async function seedPlayer(db: Kysely<DB>, id: string, name: string) {
  await db
    .insertInto("fantasy_player")
    .values({ play_cricket_id: id, player_name: name, eligible: 1 })
    .execute();
}

async function seedBatting(
  db: Kysely<DB>,
  opts: {
    matchId: string;
    playerId: string;
    matchDate: string;
    runs: number;
    balls?: number;
    fours?: number;
    sixes?: number;
    notOut?: number;
  },
) {
  await db
    .insertInto("match_performance_batting")
    .values({
      id: `bat-${opts.matchId}-${opts.playerId}`,
      match_id: opts.matchId,
      player_id: opts.playerId,
      player_name: "Player",
      team_id: TEAM_1ST_XI,
      competition_type: "League",
      match_date: opts.matchDate,
      season: 2026,
      runs: opts.runs,
      balls: opts.balls ?? opts.runs + 10,
      fours: opts.fours ?? 0,
      sixes: opts.sixes ?? 0,
      not_out: opts.notOut ?? 0,
    })
    .execute();
}

async function seedMatchResult(
  db: Kysely<DB>,
  matchId: string,
  matchDate: string,
  winnerId: string = TEAM_1ST_XI,
) {
  await db
    .insertInto("match_result")
    .values({
      id: `result-${matchId}`,
      match_id: matchId,
      home_team_id: TEAM_1ST_XI,
      away_team_id: "opponent",
      home_team_name: "Home",
      away_team_name: "Away",
      result: "Won",
      result_description: "Home won",
      result_applied_to: winnerId,
      competition_type: "League",
      match_date: matchDate,
      season: 2026,
    })
    .execute();
}

describe("calculateFantasyScores", () => {
  let db: Kysely<DB>;

  beforeEach(async () => {
    db = createTestDb();
    await setupSchema(db);
  });

  it("calculates player scores from batting performance", async () => {
    await seedPlayer(db, "p1", "Alice");
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      runs: 55,
      fours: 8,
      sixes: 1,
    });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    const result = await calculateFantasyScores(db, "2026");
    expect(result.playerScoresUpserted).toBe(1);

    const scores = await db
      .selectFrom("fantasy_player_score")
      .selectAll()
      .execute();
    expect(scores).toHaveLength(1);
    expect(scores[0]!.play_cricket_id).toBe("p1");
    expect(scores[0]!.gameweek_id).toBe(1);
    // 55 runs + 8 fours (8pts) + 1 six (2pts) + 50 bonus (20pts) + win bonus (10pts) = 95
    expect(scores[0]!.batting_points).toBe(55 + 8 + 2 + 20);
    expect(scores[0]!.team_points).toBe(10);
    expect(scores[0]!.total_points).toBe(55 + 8 + 2 + 20 + 10);
  });

  it("applies captain 2x multiplier for team scores", async () => {
    await seedPlayer(db, "p1", "Captain");
    await seedPlayer(db, "p2", "Regular");
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      runs: 30,
    });
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p2",
      matchDate: GW1_MATCH_DATE,
      runs: 20,
    });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    // Create a fantasy team with p1 as captain
    await db
      .insertInto("fantasy_team")
      .values({ user_id: "user1", season: "2026" })
      .execute();
    await db
      .insertInto("fantasy_team_player")
      .values([
        {
          fantasy_team_id: 1,
          play_cricket_id: "p1",
          is_captain: 1,
          gameweek_added: 0,
        },
        {
          fantasy_team_id: 1,
          play_cricket_id: "p2",
          is_captain: 0,
          gameweek_added: 0,
        },
      ])
      .execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db
      .selectFrom("fantasy_team_score")
      .selectAll()
      .execute();
    expect(teamScores).toHaveLength(1);

    // p1 (captain): 30 runs + 10 win = 40 points, x2 = 80
    // p2 (regular): 20 runs + 10 win = 30 points, x1 = 30
    // Total = 110
    expect(teamScores[0]!.total_points).toBe(110);
  });

  it("players not playing score 0 (no penalty)", async () => {
    await seedPlayer(db, "p1", "Active");
    await seedPlayer(db, "p2", "Inactive");
    // Only p1 has match data
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      runs: 10,
    });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    // Team with both players
    await db
      .insertInto("fantasy_team")
      .values({ user_id: "user1", season: "2026" })
      .execute();
    await db
      .insertInto("fantasy_team_player")
      .values([
        {
          fantasy_team_id: 1,
          play_cricket_id: "p1",
          is_captain: 1,
          gameweek_added: 0,
        },
        {
          fantasy_team_id: 1,
          play_cricket_id: "p2",
          is_captain: 0,
          gameweek_added: 0,
        },
      ])
      .execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db
      .selectFrom("fantasy_team_score")
      .selectAll()
      .execute();
    expect(teamScores).toHaveLength(1);

    // p1 (captain): 10 runs + 10 win = 20, x2 = 40
    // p2 doesn't play = 0
    // Total = 40
    expect(teamScores[0]!.total_points).toBe(40);
  });

  it("is idempotent — re-running produces same results", async () => {
    await seedPlayer(db, "p1", "Alice");
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      runs: 50,
    });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    await calculateFantasyScores(db, "2026");
    const firstRun = await db
      .selectFrom("fantasy_player_score")
      .selectAll()
      .execute();

    await calculateFantasyScores(db, "2026");
    const secondRun = await db
      .selectFrom("fantasy_player_score")
      .selectAll()
      .execute();

    expect(secondRun).toHaveLength(firstRun.length);
    expect(secondRun[0]!.total_points).toBe(firstRun[0]!.total_points);
  });

  it("skips matches without results", async () => {
    await seedPlayer(db, "p1", "Alice");
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      runs: 50,
    });
    // No match result for m1

    const result = await calculateFantasyScores(db, "2026");
    expect(result.playerScoresUpserted).toBe(0);
  });

  it("skips matches before season start (pre-season)", async () => {
    await seedPlayer(db, "p1", "Alice");
    // March is before GW1 (April 18)
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: "01/03/2026",
      runs: 50,
    });
    await seedMatchResult(db, "m1", "01/03/2026");

    const result = await calculateFantasyScores(db, "2026");
    expect(result.playerScoresUpserted).toBe(0);
  });

  it("respects gameweek_removed for team score calculation", async () => {
    await seedPlayer(db, "p1", "Removed");
    await seedPlayer(db, "p2", "Active");
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW2_MATCH_DATE,
      runs: 100,
    });
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p2",
      matchDate: GW2_MATCH_DATE,
      runs: 10,
    });
    await seedMatchResult(db, "m1", GW2_MATCH_DATE);

    await db
      .insertInto("fantasy_team")
      .values({ user_id: "user1", season: "2026" })
      .execute();
    await db
      .insertInto("fantasy_team_player")
      .values([
        {
          fantasy_team_id: 1,
          play_cricket_id: "p1",
          is_captain: 0,
          gameweek_added: 0,
          gameweek_removed: 2, // Removed before GW2
        },
        {
          fantasy_team_id: 1,
          play_cricket_id: "p2",
          is_captain: 1,
          gameweek_added: 0,
        },
      ])
      .execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db
      .selectFrom("fantasy_team_score")
      .selectAll()
      .execute();
    expect(teamScores).toHaveLength(1);
    // p1 was removed before GW2, so only p2 counts
    // p2 (captain): 10 runs + 10 win = 20, x2 = 40
    expect(teamScores[0]!.total_points).toBe(40);
  });
});
