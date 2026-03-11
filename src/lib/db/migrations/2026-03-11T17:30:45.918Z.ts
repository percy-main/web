import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("fantasy_team")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX fantasy_team_user_season ON fantasy_team(user_id, season)`.execute(
    db,
  );

  await db.schema
    .createTable("fantasy_team_player")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("fantasy_team_id", "integer", (col) => col.notNull())
    .addColumn("play_cricket_id", "text", (col) => col.notNull())
    .addColumn("is_captain", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("gameweek_added", "integer", (col) => col.notNull())
    .addColumn("gameweek_removed", "integer")
    .execute();

  await sql`CREATE INDEX idx_ftp_team ON fantasy_team_player(fantasy_team_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_ftp_player ON fantasy_team_player(play_cricket_id)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("fantasy_team_player").execute();
  await db.schema.dropTable("fantasy_team").execute();
}
