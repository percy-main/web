import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("fantasy_chip_usage")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("fantasy_team_id", "integer", (col) =>
      col.notNull().references("fantasy_team.id"),
    )
    .addColumn("chip_type", "text", (col) => col.notNull())
    .addColumn("gameweek_id", "integer", (col) => col.notNull())
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  // Each chip can only be used once per gameweek per team
  await db.schema
    .createIndex("idx_fcu_team_chip_gameweek")
    .on("fantasy_chip_usage")
    .columns(["fantasy_team_id", "chip_type", "gameweek_id"])
    .unique()
    .execute();

  // Quick lookup of all chips used by a team in a season
  await db.schema
    .createIndex("idx_fcu_team_season")
    .on("fantasy_chip_usage")
    .columns(["fantasy_team_id", "season"])
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("fantasy_chip_usage").execute();
}
