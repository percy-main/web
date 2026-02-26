import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Cached team data from the Play-Cricket Teams API
  await db.schema
    .createTable("play_cricket_team")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("is_junior", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("site_id", "text", (col) => col.notNull())
    .addColumn("last_updated", "text")
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  // Per-player per-match batting performance
  await db.schema
    .createTable("match_performance_batting")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("team_id", "text", (col) => col.notNull())
    .addColumn("competition_type", "text", (col) =>
      col.notNull().defaultTo(""),
    )
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("runs", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("balls", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("fours", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("sixes", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("how_out", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("not_out", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX match_batting_player_unique ON match_performance_batting(match_id, player_id)`.execute(
    db,
  );

  // Per-player per-match bowling performance
  await db.schema
    .createTable("match_performance_bowling")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("team_id", "text", (col) => col.notNull())
    .addColumn("competition_type", "text", (col) =>
      col.notNull().defaultTo(""),
    )
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("overs", "text", (col) => col.notNull().defaultTo("0"))
    .addColumn("maidens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("runs", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("wickets", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("wides", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("no_balls", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX match_bowling_player_unique ON match_performance_bowling(match_id, player_id)`.execute(
    db,
  );

  // Sync log to track cron runs
  await db.schema
    .createTable("play_cricket_sync_log")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("started_at", "text", (col) => col.notNull())
    .addColumn("completed_at", "text")
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("matches_processed", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("errors", "text")
    .execute();
}
