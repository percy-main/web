import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("fantasy_player")
    .addColumn("play_cricket_id", "text", (col) => col.primaryKey())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("eligible", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE INDEX idx_fantasy_player_eligible ON fantasy_player(eligible)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("fantasy_player").execute();
}
