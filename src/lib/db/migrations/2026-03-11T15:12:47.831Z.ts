import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Per-player per-match fielding performance
  await db.schema
    .createTable("match_performance_fielding")
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
    .addColumn("catches", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("run_outs", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("stumpings", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_wicketkeeper", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX match_fielding_player_unique ON match_performance_fielding(match_id, player_id)`.execute(
    db,
  );

  await sql`CREATE INDEX idx_fielding_season_team ON match_performance_fielding(season, team_id, competition_type)`.execute(
    db,
  );

  await sql`CREATE INDEX idx_fielding_player ON match_performance_fielding(player_id)`.execute(
    db,
  );

  // Match result for win bonus scoring
  await db.schema
    .createTable("match_result")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("match_id", "text", (col) => col.notNull())
    .addColumn("home_team_id", "text", (col) => col.notNull())
    .addColumn("away_team_id", "text", (col) => col.notNull())
    .addColumn("home_team_name", "text", (col) => col.notNull())
    .addColumn("away_team_name", "text", (col) => col.notNull())
    .addColumn("result", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("result_description", "text", (col) =>
      col.notNull().defaultTo(""),
    )
    .addColumn("result_applied_to", "text", (col) =>
      col.notNull().defaultTo(""),
    )
    .addColumn("competition_type", "text", (col) =>
      col.notNull().defaultTo(""),
    )
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX match_result_match_unique ON match_result(match_id)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("match_performance_fielding").execute();
  await db.schema.dropTable("match_result").execute();
}
