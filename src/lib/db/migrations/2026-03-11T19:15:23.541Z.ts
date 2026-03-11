import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // Per-player per-match scores for a gameweek
  await db.schema
    .createTable("fantasy_player_score")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("gameweek_id", "integer", (col) => col.notNull())
    .addColumn("play_cricket_id", "text", (col) =>
      col.notNull().references("fantasy_player.play_cricket_id"),
    )
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("batting_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("bowling_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("fielding_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("team_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("total_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await db.schema
    .createIndex("idx_fps_gameweek_player_match")
    .on("fantasy_player_score")
    .columns(["season", "gameweek_id", "play_cricket_id", "match_id"])
    .unique()
    .execute();

  await db.schema
    .createIndex("idx_fps_play_cricket_id")
    .on("fantasy_player_score")
    .column("play_cricket_id")
    .execute();

  // Per-team per-gameweek aggregated scores
  await db.schema
    .createTable("fantasy_team_score")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("gameweek_id", "integer", (col) => col.notNull())
    .addColumn("fantasy_team_id", "integer", (col) =>
      col.notNull().references("fantasy_team.id"),
    )
    .addColumn("total_points", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await db.schema
    .createIndex("idx_fts_gameweek_team")
    .on("fantasy_team_score")
    .columns(["season", "gameweek_id", "fantasy_team_id"])
    .unique()
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("fantasy_team_score").execute();
  await db.schema.dropTable("fantasy_player_score").execute();
}
