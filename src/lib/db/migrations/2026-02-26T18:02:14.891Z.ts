import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("play_cricket_match_cache")
    .addColumn("match_id", "text", (col) => col.primaryKey())
    .addColumn("data", "text", (col) => col.notNull())
    .addColumn("fetched_at", "text", (col) => col.notNull())
    .addColumn("match_date", "text", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("play_cricket_match_cache").execute();
}
