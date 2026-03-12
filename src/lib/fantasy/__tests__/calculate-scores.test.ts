import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "../../db/__generated__/db";
import { calculateFantasyScores, calculateSlotEffectivePoints } from "../calculate-scores";
import type { SlotType } from "../scoring";

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
    .addColumn("sandwich_cost", "integer", (col) => col.notNull().defaultTo(1))
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
    .addColumn("slot_type", "text", (col) => col.notNull().defaultTo("batting"))
    .addColumn("is_wicketkeeper", "integer", (col) => col.notNull().defaultTo(0))
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
    .addColumn("catches", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_actual_keeper", "integer", (col) => col.notNull().defaultTo(0))
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

  await db.schema
    .createTable("fantasy_chip_usage")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("fantasy_team_id", "integer", (col) => col.notNull())
    .addColumn("chip_type", "text", (col) => col.notNull())
    .addColumn("gameweek_id", "integer", (col) => col.notNull())
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo("now"))
    .execute();

  await db.schema
    .createIndex("idx_fcu_team_chip_gameweek")
    .on("fantasy_chip_usage")
    .columns(["fantasy_team_id", "chip_type", "gameweek_id"])
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

async function seedBowling(
  db: Kysely<DB>,
  opts: {
    matchId: string;
    playerId: string;
    matchDate: string;
    overs: string;
    maidens?: number;
    runs: number;
    wickets: number;
  },
) {
  await db
    .insertInto("match_performance_bowling")
    .values({
      id: `bowl-${opts.matchId}-${opts.playerId}`,
      match_id: opts.matchId,
      player_id: opts.playerId,
      player_name: "Player",
      team_id: TEAM_1ST_XI,
      competition_type: "League",
      match_date: opts.matchDate,
      season: 2026,
      overs: opts.overs,
      maidens: opts.maidens ?? 0,
      runs: opts.runs,
      wickets: opts.wickets,
    })
    .execute();
}

async function seedFielding(
  db: Kysely<DB>,
  opts: {
    matchId: string;
    playerId: string;
    matchDate: string;
    catches?: number;
    runOuts?: number;
    stumpings?: number;
    isWicketkeeper?: number;
  },
) {
  await db
    .insertInto("match_performance_fielding")
    .values({
      id: `field-${opts.matchId}-${opts.playerId}`,
      match_id: opts.matchId,
      player_id: opts.playerId,
      player_name: "Player",
      team_id: TEAM_1ST_XI,
      competition_type: "League",
      match_date: opts.matchDate,
      season: 2026,
      catches: opts.catches ?? 0,
      run_outs: opts.runOuts ?? 0,
      stumpings: opts.stumpings ?? 0,
      is_wicketkeeper: opts.isWicketkeeper ?? 0,
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

  it("stores catches and is_actual_keeper in player scores", async () => {
    await seedPlayer(db, "p1", "Keeper");
    await seedFielding(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      catches: 3,
      isWicketkeeper: 1,
    });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    await calculateFantasyScores(db, "2026");

    const scores = await db
      .selectFrom("fantasy_player_score")
      .selectAll()
      .execute();
    expect(scores).toHaveLength(1);
    expect(scores[0]!.catches).toBe(3);
    expect(scores[0]!.is_actual_keeper).toBe(1);
  });

  it("applies slot-based scoring — batting slot excludes bowling", async () => {
    await seedPlayer(db, "p1", "Batter");
    await seedBatting(db, { matchId: "m1", playerId: "p1", matchDate: GW1_MATCH_DATE, runs: 30 });
    await seedBowling(db, { matchId: "m1", playerId: "p1", matchDate: GW1_MATCH_DATE, overs: "5", runs: 20, wickets: 2 });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    await db.insertInto("fantasy_team").values({ user_id: "u1", season: "2026" }).execute();
    await db.insertInto("fantasy_team_player").values({
      fantasy_team_id: 1,
      play_cricket_id: "p1",
      is_captain: 0,
      gameweek_added: 0,
      slot_type: "batting",
    }).execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db.selectFrom("fantasy_team_score").selectAll().execute();
    // Batting slot: batting (30) + team (10) = 40 (bowling excluded)
    // Bowling was 2 wickets = 20pts, but excluded from batting slot
    expect(teamScores[0]!.total_points).toBe(40);
  });

  it("applies slot-based scoring — bowling slot excludes batting", async () => {
    await seedPlayer(db, "p1", "Bowler");
    await seedBatting(db, { matchId: "m1", playerId: "p1", matchDate: GW1_MATCH_DATE, runs: 30 });
    await seedBowling(db, { matchId: "m1", playerId: "p1", matchDate: GW1_MATCH_DATE, overs: "5", runs: 20, wickets: 2 });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    await db.insertInto("fantasy_team").values({ user_id: "u1", season: "2026" }).execute();
    await db.insertInto("fantasy_team_player").values({
      fantasy_team_id: 1,
      play_cricket_id: "p1",
      is_captain: 0,
      gameweek_added: 0,
      slot_type: "bowling",
    }).execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db.selectFrom("fantasy_team_score").selectAll().execute();
    // Bowling slot: bowling (20) + team (10) = 30 (batting excluded)
    expect(teamScores[0]!.total_points).toBe(30);
  });

  it("allrounder slot includes all categories", async () => {
    await seedPlayer(db, "p1", "Allrounder");
    await seedBatting(db, { matchId: "m1", playerId: "p1", matchDate: GW1_MATCH_DATE, runs: 30 });
    await seedBowling(db, { matchId: "m1", playerId: "p1", matchDate: GW1_MATCH_DATE, overs: "5", runs: 20, wickets: 2 });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

    await db.insertInto("fantasy_team").values({ user_id: "u1", season: "2026" }).execute();
    await db.insertInto("fantasy_team_player").values({
      fantasy_team_id: 1,
      play_cricket_id: "p1",
      is_captain: 0,
      gameweek_added: 0,
      slot_type: "allrounder",
    }).execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db.selectFrom("fantasy_team_score").selectAll().execute();
    // Allrounder: batting (30) + bowling (20) + team (10) = 60
    expect(teamScores[0]!.total_points).toBe(60);
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

    // Create a fantasy team with p1 as captain (batting slot)
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
          slot_type: "batting",
        },
        {
          fantasy_team_id: 1,
          play_cricket_id: "p2",
          is_captain: 0,
          gameweek_added: 0,
          slot_type: "batting",
        },
      ])
      .execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db
      .selectFrom("fantasy_team_score")
      .selectAll()
      .execute();
    expect(teamScores).toHaveLength(1);

    // p1 (captain, batting slot): (30 runs + 10 win) * 2 = 80
    // p2 (regular, batting slot): 20 runs + 10 win = 30
    // Total = 110
    expect(teamScores[0]!.total_points).toBe(110);
  });

  it("players not playing score 0 (no penalty)", async () => {
    await seedPlayer(db, "p1", "Active");
    await seedPlayer(db, "p2", "Inactive");
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      runs: 10,
    });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);

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
          slot_type: "batting",
        },
        {
          fantasy_team_id: 1,
          play_cricket_id: "p2",
          is_captain: 0,
          gameweek_added: 0,
          slot_type: "batting",
        },
      ])
      .execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db
      .selectFrom("fantasy_team_score")
      .selectAll()
      .execute();
    expect(teamScores).toHaveLength(1);

    // p1 (captain): (10 runs + 10 win) * 2 = 40
    // p2 doesn't play = 0
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

    const result = await calculateFantasyScores(db, "2026");
    expect(result.playerScoresUpserted).toBe(0);
  });

  it("skips matches before season start (pre-season)", async () => {
    await seedPlayer(db, "p1", "Alice");
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

  it("applies triple captain 3x multiplier when chip is active", async () => {
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

    // Activate triple captain chip for GW1
    await db
      .insertInto("fantasy_chip_usage")
      .values({
        fantasy_team_id: 1,
        chip_type: "triple_captain",
        gameweek_id: 1,
        season: "2026",
      })
      .execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db
      .selectFrom("fantasy_team_score")
      .selectAll()
      .execute();
    expect(teamScores).toHaveLength(1);

    // p1 (captain, triple captain active): 30 runs + 10 win = 40 points, x3 = 120
    // p2 (regular): 20 runs + 10 win = 30 points, x1 = 30
    // Total = 150
    expect(teamScores[0]!.total_points).toBe(150);
  });

  it("does not apply triple captain to non-activated gameweeks", async () => {
    await seedPlayer(db, "p1", "Captain");
    await seedBatting(db, {
      matchId: "m1",
      playerId: "p1",
      matchDate: GW1_MATCH_DATE,
      runs: 30,
    });
    await seedBatting(db, {
      matchId: "m2",
      playerId: "p1",
      matchDate: GW2_MATCH_DATE,
      runs: 30,
    });
    await seedMatchResult(db, "m1", GW1_MATCH_DATE);
    await seedMatchResult(db, "m2", GW2_MATCH_DATE);

    await db
      .insertInto("fantasy_team")
      .values({ user_id: "user1", season: "2026" })
      .execute();
    await db
      .insertInto("fantasy_team_player")
      .values({
        fantasy_team_id: 1,
        play_cricket_id: "p1",
        is_captain: 1,
        gameweek_added: 0,
      })
      .execute();

    // Activate triple captain chip only for GW1, not GW2
    await db
      .insertInto("fantasy_chip_usage")
      .values({
        fantasy_team_id: 1,
        chip_type: "triple_captain",
        gameweek_id: 1,
        season: "2026",
      })
      .execute();

    await calculateFantasyScores(db, "2026");

    const teamScores = await db
      .selectFrom("fantasy_team_score")
      .selectAll()
      .orderBy("gameweek_id", "asc")
      .execute();
    expect(teamScores).toHaveLength(2);

    // GW1 with triple captain: (30 + 10) * 3 = 120
    expect(teamScores[0]!.total_points).toBe(120);
    // GW2 without triple captain: (30 + 10) * 2 = 80
    expect(teamScores[1]!.total_points).toBe(80);
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
          gameweek_removed: 2,
          slot_type: "batting",
        },
        {
          fantasy_team_id: 1,
          play_cricket_id: "p2",
          is_captain: 1,
          gameweek_added: 0,
          slot_type: "batting",
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
    // p2 (captain): (10 runs + 10 win) * 2 = 40
    expect(teamScores[0]!.total_points).toBe(40);
  });
});

describe("calculateSlotEffectivePoints", () => {
  it("batting slot excludes bowling points", () => {
    const pts = calculateSlotEffectivePoints({
      slotType: "batting",
      isFantasyWk: false,
      battingPts: 50,
      bowlingPts: 30,
      fieldingPts: 10,
      teamPts: 10,
      catches: 1,
      isActualKeeper: false,
      isCaptain: false,
    });
    // batting(50) + fielding(10) + team(10) = 70
    expect(pts).toBe(70);
  });

  it("bowling slot excludes batting points", () => {
    const pts = calculateSlotEffectivePoints({
      slotType: "bowling",
      isFantasyWk: false,
      battingPts: 50,
      bowlingPts: 30,
      fieldingPts: 10,
      teamPts: 10,
      catches: 1,
      isActualKeeper: false,
      isCaptain: false,
    });
    // bowling(30) + fielding(10) + team(10) = 50
    expect(pts).toBe(50);
  });

  it("allrounder slot includes all", () => {
    const pts = calculateSlotEffectivePoints({
      slotType: "allrounder",
      isFantasyWk: false,
      battingPts: 50,
      bowlingPts: 30,
      fieldingPts: 10,
      teamPts: 10,
      catches: 1,
      isActualKeeper: false,
      isCaptain: false,
    });
    // all = 100
    expect(pts).toBe(100);
  });

  it("captain doubles effective points", () => {
    const pts = calculateSlotEffectivePoints({
      slotType: "batting",
      isFantasyWk: false,
      battingPts: 50,
      bowlingPts: 0,
      fieldingPts: 10,
      teamPts: 10,
      catches: 0,
      isActualKeeper: false,
      isCaptain: true,
    });
    // (50 + 10 + 10) * 2 = 140
    expect(pts).toBe(140);
  });

  it("WK adjustment: fantasy WK but not actual keeper reduces catch pts", () => {
    // Player is tagged as fantasy WK but wasn't actual keeper
    // Catches were scored at 10pt (fielder rate), but should be 5pt (keeper rate)
    // 2 catches at 10pt = 20pts fielding, adjustment = 2 * (5-10) = -10
    const pts = calculateSlotEffectivePoints({
      slotType: "batting",
      isFantasyWk: true,
      battingPts: 30,
      bowlingPts: 0,
      fieldingPts: 20, // 2 catches at 10pt
      teamPts: 10,
      catches: 2,
      isActualKeeper: false,
      isCaptain: false,
    });
    // batting(30) + fielding(20 - 10) + team(10) = 50
    expect(pts).toBe(50);
  });

  it("WK adjustment: not fantasy WK but actual keeper increases catch pts", () => {
    // Player is actual keeper but not tagged as fantasy WK
    // Catches were scored at 5pt (keeper rate), but should be 10pt (fielder rate)
    // 2 catches at 5pt = 10pts fielding, adjustment = 2 * (10-5) = +10
    const pts = calculateSlotEffectivePoints({
      slotType: "batting",
      isFantasyWk: false,
      battingPts: 30,
      bowlingPts: 0,
      fieldingPts: 10, // 2 catches at 5pt
      teamPts: 10,
      catches: 2,
      isActualKeeper: true,
      isCaptain: false,
    });
    // batting(30) + fielding(10 + 10) + team(10) = 60
    expect(pts).toBe(60);
  });

  it("no WK adjustment when fantasy WK matches actual keeper", () => {
    const pts = calculateSlotEffectivePoints({
      slotType: "batting",
      isFantasyWk: true,
      battingPts: 30,
      bowlingPts: 0,
      fieldingPts: 10, // 2 catches at 5pt (keeper rate)
      teamPts: 10,
      catches: 2,
      isActualKeeper: true,
      isCaptain: false,
    });
    // No adjustment: batting(30) + fielding(10) + team(10) = 50
    expect(pts).toBe(50);
  });
});
