import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("fantasy_chaos_week")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("season", "text", (col) => col.notNull())
    .addColumn("gameweek_id", "integer", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("rule_type", "text", (col) => col.notNull())
    .addColumn("rule_config", "text", (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("send_email", "integer", (col) =>
      col.notNull().defaultTo(1),
    )
    .addColumn("email_sent", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  // One chaos rule per gameweek per season
  await db.schema
    .createIndex("idx_fcw_season_gameweek")
    .on("fantasy_chaos_week")
    .columns(["season", "gameweek_id"])
    .unique()
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("fantasy_chaos_week").execute();
}
